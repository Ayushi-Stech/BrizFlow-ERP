# BizFlow ERP — Backend API

Node.js + TypeScript + Express REST API backing the BizFlow ERP frontend.
Plain PostgreSQL, JWT auth, zod validation, transactional business logic.

See the root [`README.md`](../README.md) for setup, environment variables,
and deployment instructions. This document is the endpoint reference.

## Conventions

- All requests/responses are JSON.
- Authenticated routes require `Authorization: Bearer <token>`.
- List endpoints accept `?page=` (0-based, default `0`) and `?pageSize=`
  (default varies by resource, max `100`) and respond with
  `{ rows: [...], count: <total>, page, pageSize }`.
- Errors respond with `{ "error": "message", "details"?: ... }` and an
  appropriate status code: `400` validation, `401` unauthenticated, `403`
  wrong role, `404` not found, `409` conflict (e.g. duplicate email,
  insufficient stock), `500` unexpected.
- Roles: `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`.

## Auth

### `POST /auth/register`
Body: `{ name, email, password, role }`. Public. Creates an account and
returns a token.
→ `201 { token, user: { id, name, email, role } }`

### `POST /auth/login`
Body: `{ email, password }`. Public. Rate-limited (20 requests / 15 min).
→ `200 { token, user }`

### `GET /auth/me`
Auth required. Returns the current user.
→ `200 { user }`

## Users

### `GET /users`
Admin only. Team directory.
→ `200 { rows: [{ id, name, email, role, created_at }] }`

## Customers

### `GET /customers`
Auth required (any role). Query params: `search`, `status`
(`LEAD|ACTIVE|INACTIVE`), `type` (`RETAIL|WHOLESALE|DISTRIBUTOR`), `page`,
`pageSize`. Pass `?options=true` to instead get a flat, unpaginated list of
`{ id, name, business_name }` for non-inactive customers (used to populate
the challan-creation dropdown).
→ `200 { rows, count, page, pageSize }`

### `GET /customers/:id`
→ `200 { customer }`

### `POST /customers`
Admin or Sales. Body: `{ name, mobile, email?, business_name?, gst_number?, customer_type, address?, status, follow_up_date?, notes? }`
→ `201 { customer }`

### `PUT /customers/:id`
Admin or Sales. Same body shape as create.
→ `200 { customer }`

### `GET /customers/:id/followups`
Auth required. Chronological follow-up note history.
→ `200 { rows: [{ id, note, created_at, created_by, created_by_name }] }`

### `POST /customers/:id/followups`
Admin or Sales. Body: `{ note }`.
→ `201 { followup }`

## Products

### `GET /products`
Auth required. Query params: `search`, `page`, `pageSize`. Pass
`?options=true` for a flat, unpaginated list (used by the stock-adjustment
and challan-creation forms).
→ `200 { rows, count, page, pageSize }`

### `GET /products/:id`
→ `200 { product }`

### `POST /products`
Admin or Warehouse. Body: `{ name, sku, category?, unit_price, minimum_stock, warehouse_location?, current_stock? }`.
`current_stock` (if > 0) becomes a logged "Opening stock" `IN` movement
rather than being written directly.
→ `201 { product }`

### `PUT /products/:id`
Admin or Warehouse. Same shape minus `current_stock` — stock is never edited
here, only through `/stock-movements`.
→ `200 { product }`

## Stock movements

### `GET /stock-movements`
Auth required. Query params: `productId` (filter), `page`, `pageSize`.
Newest first, joined with product and creator names.
→ `200 { rows, count, page, pageSize }`

### `POST /stock-movements`
Admin or Warehouse. Body: `{ product_id, quantity, movement_type: "IN"|"OUT", reason? }`.
Runs inside a transaction with a row lock on the product; an `OUT` that
exceeds current stock is rejected with `409` and nothing is written.
→ `201 { product }` (the updated product row)

## Challans

### `GET /challans`
Auth required. Query params: `search` (matches challan number), `status`
(`DRAFT|CONFIRMED|CANCELLED`), `page`, `pageSize`.
→ `200 { rows, count, page, pageSize }`

### `GET /challans/:id`
Full detail including customer info and line items.
→ `200 { challan: { ...challan, items: [{ id, product_name, sku, unit_price, quantity }] } }`

### `POST /challans`
Admin or Sales. Body:
```json
{
  "customer_id": "uuid",
  "notes": "optional",
  "items": [{ "product_id": "uuid", "quantity": 3 }],
  "confirm": false
}
```
Creates a `DRAFT` challan with product-snapshotted line items and an
auto-generated challan number (`CH-<year>-00001`, incrementing per year). If
`confirm: true`, atomically confirms it in the same transaction (see below).
→ `201 { challan }`

### `POST /challans/:id/confirm`
Admin or Sales. Confirms a `DRAFT` challan: validates and deducts stock for
every line item inside one transaction (each product row locked via
`SELECT ... FOR UPDATE`), logs an `OUT` stock movement per item, and flips
the challan to `CONFIRMED`. If any single line is short on stock, the entire
confirmation is rolled back and `409` is returned — no partial deductions.
Only `DRAFT` challans can be confirmed (`409` otherwise).
→ `200 { challan }`

## Dashboard

### `GET /dashboard`
Auth required. Aggregate snapshot for the home screen.
→
```json
{
  "customerCount": 4,
  "productCount": 8,
  "confirmedCount": 2,
  "confirmedValue": 148500,
  "lowStock": [{ "id", "name", "sku", "current_stock", "minimum_stock" }],
  "recent": [{ "id", "challan_number", "status", "total_quantity", "total_amount", "created_at", "customer_name", "customer_business_name" }]
}
```

## Health check

### `GET /health`
No auth. → `200 { status: "ok" }`
