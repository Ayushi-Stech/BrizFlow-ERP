/** Extracts a human-readable message from thrown Errors, including ApiError from lib/api.ts. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error_description?: unknown };
    if (typeof candidate.message === "string" && candidate.message) return candidate.message;
    if (typeof candidate.error_description === "string" && candidate.error_description)
      return candidate.error_description;
  }
  return fallback;
}
