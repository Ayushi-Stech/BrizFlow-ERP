import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { AppError } from "../utils/AppError";
import { applyStockMovement } from "./stock";

export type ChallanItemInput = { product_id: string; quantity: number };

/** Generates the next human-readable challan number, e.g. CH-2026-00001. Atomic per year. */
async function nextChallanNumber(client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const result = await client.query(
    `INSERT INTO challan_counters (year, last_number) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_number = challan_counters.last_number + 1
     RETURNING last_number`,
    [year],
  );
  const next = result.rows[0].last_number as number;
  return `CH-${year}-${String(next).padStart(5, "0")}`;
}

/**
 * Creates a draft challan with product snapshot line items inside one transaction.
 * Optionally confirms it immediately (see confirmChallan for the stock-reduction rules).
 */
export async function createChallan(
  client: PoolClient,
  params: {
    customerId: string;
    items: ChallanItemInput[];
    notes: string | null;
    actorId: string;
    confirm: boolean;
  },
) {
  const { customerId, items, notes, actorId, confirm } = params;
  if (!items.length) throw AppError.badRequest("Challan must contain at least one product");

  const seen = new Set<string>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw AppError.badRequest("Quantity must be a whole number greater than zero");
    }
    if (seen.has(item.product_id)) {
      throw AppError.badRequest("A product is repeated — merge the quantities instead");
    }
    seen.add(item.product_id);
  }

  const customerResult = await client.query("SELECT id FROM customers WHERE id = $1", [customerId]);
  if (!customerResult.rowCount) throw AppError.badRequest("Customer not found");

  const challanId = randomUUID();
  const challanNumber = await nextChallanNumber(client);

  let totalQuantity = 0;
  let totalAmount = 0;
  const snapshots: Array<{ id: string; product_id: string; product_name: string; sku: string; unit_price: number; quantity: number }> = [];

  for (const item of items) {
    const productResult = await client.query(
      "SELECT id, name, sku, unit_price FROM products WHERE id = $1",
      [item.product_id],
    );
    const product = productResult.rows[0];
    if (!product) throw AppError.badRequest(`Product ${item.product_id} not found`);

    snapshots.push({
      id: randomUUID(),
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      unit_price: Number(product.unit_price),
      quantity: item.quantity,
    });
    totalQuantity += item.quantity;
    totalAmount += item.quantity * Number(product.unit_price);
  }

  await client.query(
    `INSERT INTO challans (id, challan_number, customer_id, total_quantity, total_amount, status, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7)`,
    [challanId, challanNumber, customerId, totalQuantity, totalAmount, notes, actorId],
  );

  for (const s of snapshots) {
    await client.query(
      `INSERT INTO challan_items (id, challan_id, product_id, product_name, sku, unit_price, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [s.id, challanId, s.product_id, s.product_name, s.sku, s.unit_price, s.quantity],
    );
  }

  if (confirm) {
    await confirmChallanById(client, challanId, actorId);
  }

  const result = await client.query("SELECT * FROM challans WHERE id = $1", [challanId]);
  return result.rows[0];
}

/**
 * Confirms a draft challan: validates and reduces stock for every line item
 * atomically (each product row is locked via applyStockMovement's FOR UPDATE),
 * logs an OUT stock movement per item, and flips the challan to CONFIRMED.
 * Rolls back entirely if any single line has insufficient stock.
 */
export async function confirmChallanById(client: PoolClient, challanId: string, actorId: string) {
  const challanResult = await client.query("SELECT * FROM challans WHERE id = $1 FOR UPDATE", [
    challanId,
  ]);
  const challan = challanResult.rows[0];
  if (!challan) throw AppError.notFound("Challan not found");
  if (challan.status !== "DRAFT") {
    throw AppError.conflict("Only draft challans can be confirmed");
  }

  const itemsResult = await client.query(
    "SELECT product_id, product_name, quantity FROM challan_items WHERE challan_id = $1",
    [challanId],
  );

  for (const item of itemsResult.rows) {
    if (!item.product_id) {
      throw AppError.conflict(`Product ${item.product_name} no longer exists`);
    }
    await applyStockMovement(client, {
      productId: item.product_id,
      quantity: item.quantity,
      movementType: "OUT",
      reason: `Sales Challan ${challan.challan_number}`,
      actorId,
    });
  }

  const updated = await client.query(
    "UPDATE challans SET status = 'CONFIRMED', confirmed_at = now() WHERE id = $1 RETURNING *",
    [challanId],
  );
  return updated.rows[0];
}
