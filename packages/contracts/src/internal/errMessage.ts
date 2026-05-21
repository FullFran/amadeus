/**
 * Extracts a human-readable message from an unknown thrown value.
 *
 * Use when:
 * - A `catch (error)` block needs a string for logging or a structured result.
 *
 * Expects:
 * - Anything (Error instance, string, plain object, undefined).
 *
 * Returns:
 * - `error.message` when it is an Error, otherwise `String(error)`.
 */
export function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
