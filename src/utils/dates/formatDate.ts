import { format, parseISO } from "date-fns";

/**
 * Formats an ISO 8601 date string to "MMM d, yyyy" (e.g. "Apr 5, 2026")
 */
export function formatDate(isoString: string): string {
  return format(parseISO(isoString), "MMM d, yyyy");
}
