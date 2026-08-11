import type { Request } from "express";

export type Pagination = { page: number; pageSize: number; offset: number };

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 100;

/** Reads ?page (0-based) and ?pageSize from the query string with safe bounds. */
export function getPagination(req: Request, defaultPageSize = DEFAULT_PAGE_SIZE): Pagination {
  const page = Math.max(0, Number.parseInt(String(req.query.page ?? "0"), 10) || 0);
  const pageSizeRaw = Number.parseInt(String(req.query.pageSize ?? defaultPageSize), 10);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : defaultPageSize),
  );
  return { page, pageSize, offset: page * pageSize };
}
