import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { pool, withTransaction } from "../db";
import { env } from "../env";
import { applyStockMovement } from "../services/stock";

const DEMO_USERS = [
  { name: "Aditi Admin", email: "admin@bizflow.in", role: "ADMIN" as const },
  { name: "Rohan Sales", email: "sales@bizflow.in", role: "SALES" as const },
  { name: "Vikram Warehouse", email: "warehouse@bizflow.in", role: "WAREHOUSE" as const },
  { name: "Neha Accounts", email: "accounts@bizflow.in", role: "ACCOUNTS" as const },
];

const DEMO_CUSTOMERS = [
  {
    name: "Rahul Sharma",
    mobile: "9876543210",
    email: "rahul@abctraders.in",
    business_name: "ABC Traders",
    gst_number: "24AABCU9603R1ZM",
    customer_type: "WHOLESALE",
    address: "12 MG Road, Vadodara, Gujarat",
    status: "ACTIVE",
    follow_up_date: "2026-08-20",
    notes: "Interested in bulk purchase of mobiles.",
  },
  {
    name: "Amit Patel",
    mobile: "9825011122",
    email: "amit@xyzstore.in",
    business_name: "XYZ Store",
    gst_number: "24AAGCX1234K1Z9",
    customer_type: "RETAIL",
    address: "Shop 4, Alkapuri, Vadodara",
    status: "LEAD",
    follow_up_date: "2026-08-15",
    notes: "Asked for retail price list.",
  },
  {
    name: "Priya Desai",
    mobile: "9900112233",
    email: "priya@pqrdist.in",
    business_name: "PQR Distributors",
    gst_number: "27AACCP2233L1ZQ",
    customer_type: "DISTRIBUTOR",
    address: "Plot 22, Andheri East, Mumbai",
    status: "ACTIVE",
    follow_up_date: "2026-08-25",
    notes: "Monthly distributor, pays on time.",
  },
  {
    name: "Suresh Iyer",
    mobile: "9711223344",
    email: "suresh@sunelectro.in",
    business_name: "Sun Electronics",
    gst_number: "29AABCS7788M1ZX",
    customer_type: "RETAIL",
    address: "44 Brigade Road, Bengaluru",
    status: "INACTIVE",
    follow_up_date: null,
    notes: "Dormant since last quarter.",
  },
];

const DEMO_PRODUCTS = [
  { name: "iPhone 15", sku: "IP15-128", category: "Mobile", unit_price: 65000, opening_stock: 20, minimum_stock: 5, warehouse_location: "Vadodara" },
  { name: "MacBook Air M3", sku: "MBA-M3-256", category: "Laptop", unit_price: 115000, opening_stock: 4, minimum_stock: 5, warehouse_location: "Vadodara" },
  { name: "Dell Inspiron 15", sku: "DL-INS-15", category: "Laptop", unit_price: 55000, opening_stock: 12, minimum_stock: 4, warehouse_location: "Ahmedabad" },
  { name: "Logitech Keyboard K380", sku: "LG-K380", category: "Accessories", unit_price: 3200, opening_stock: 3, minimum_stock: 6, warehouse_location: "Vadodara" },
  { name: "Samsung Galaxy S24", sku: "SGS24-256", category: "Mobile", unit_price: 74999, opening_stock: 15, minimum_stock: 5, warehouse_location: "Mumbai" },
  { name: "Sony WH-1000XM5", sku: "SNY-XM5", category: "Audio", unit_price: 29990, opening_stock: 9, minimum_stock: 3, warehouse_location: "Mumbai" },
  { name: "HP LaserJet Printer", sku: "HP-LJ-1020", category: "Printer", unit_price: 18500, opening_stock: 2, minimum_stock: 4, warehouse_location: "Ahmedabad" },
  { name: "Anker 65W Charger", sku: "ANK-65W", category: "Accessories", unit_price: 2999, opening_stock: 40, minimum_stock: 10, warehouse_location: "Vadodara" },
];

async function main() {
  console.log("Seeding demo data...");
  const passwordHash = await bcrypt.hash(env.seedPassword, 10);

  const userIds: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [u.email]);
    if (existing.rowCount) {
      userIds[u.role] = existing.rows[0].id;
      continue;
    }
    const id = randomUUID();
    await pool.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)",
      [id, u.name, u.email, passwordHash, u.role],
    );
    userIds[u.role] = id;
  }
  const adminId = userIds.ADMIN;

  for (const c of DEMO_CUSTOMERS) {
    const existing = await pool.query("SELECT id FROM customers WHERE mobile = $1", [c.mobile]);
    if (existing.rowCount) continue;
    await pool.query(
      `INSERT INTO customers (id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        randomUUID(),
        c.name,
        c.mobile,
        c.email,
        c.business_name,
        c.gst_number,
        c.customer_type,
        c.address,
        c.status,
        c.follow_up_date,
        c.notes,
        adminId,
      ],
    );
  }

  for (const p of DEMO_PRODUCTS) {
    const existing = await pool.query("SELECT id FROM products WHERE sku = $1", [p.sku]);
    if (existing.rowCount) continue;
    const id = randomUUID();
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO products (id, name, sku, category, unit_price, current_stock, minimum_stock, warehouse_location, created_by)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8)`,
        [id, p.name, p.sku, p.category, p.unit_price, p.minimum_stock, p.warehouse_location, adminId],
      );
      await applyStockMovement(client, {
        productId: id,
        quantity: p.opening_stock,
        movementType: "IN",
        reason: "Opening stock",
        actorId: adminId,
      });
    });
  }

  console.log("Seed complete. Demo login credentials (same password for all):");
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
  console.log(`  password:  ${env.seedPassword}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
