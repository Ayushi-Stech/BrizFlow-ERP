import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { AppError } from "../utils/AppError";

type MovementType = "IN" | "OUT";

/**
 * Applies a stock movement to a product and logs it, atomically.
 * Must be called with a client that already has a transaction BEGUN
 * (the caller is responsible for BEGIN/COMMIT/ROLLBACK).
 * Locks the product row (FOR UPDATE) so concurrent movements/challans
 * can never push stock negative.
 */
export async function applyStockMovement(
  client: PoolClient,
  params: {
    productId: string;
    quantity: number;
    movementType: MovementType;
    reason: string;
    actorId: string;
  },
) {
  const { productId, quantity, movementType, reason, actorId } = params;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw AppError.badRequest("Quantity must be a whole number greater than zero");
  }

  const productResult = await client.query(
    "SELECT id, name, current_stock FROM products WHERE id = $1 FOR UPDATE",
    [productId],
  );
  const product = productResult.rows[0];
  if (!product) throw AppError.notFound("Product not found");

  if (movementType === "OUT" && product.current_stock < quantity) {
    throw AppError.conflict(
      `Insufficient stock for ${product.name} (available ${product.current_stock}, requested ${quantity})`,
    );
  }

  const delta = movementType === "IN" ? quantity : -quantity;
  const updated = await client.query(
    "UPDATE products SET current_stock = current_stock + $1 WHERE id = $2 RETURNING *",
    [delta, productId],
  );

  await client.query(
    `INSERT INTO stock_movements (id, product_id, quantity, movement_type, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), productId, quantity, movementType, reason, actorId],
  );

  return updated.rows[0];
}
