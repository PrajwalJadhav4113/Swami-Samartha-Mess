/**
 * Formats a Date or date string to a customer-facing date representation using UTC components.
 * This prevents timezone shifts (e.g. 23:59:59.999Z rolling into the next day in IST +5:30).
 */
export function formatDateUTC(
  dateInput: Date | string | null | undefined,
  options: {
    format?: "shortDate" | "mediumDate" | "isoDate"; // "shortDate": "01/09/2026", "mediumDate": "01 Sep 2026", "isoDate": "2026-09-01"
  } = {}
): string {
  if (!dateInput) return "";

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const day = d.getUTCDate();
  const monthIdx = d.getUTCMonth();
  const year = d.getUTCFullYear();

  const monthNamesShort = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const pad = (n: number) => String(n).padStart(2, "0");

  const fmt = options.format || "shortDate";
  if (fmt === "isoDate") {
    return `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
  } else if (fmt === "mediumDate") {
    return `${pad(day)} ${monthNamesShort[monthIdx]} ${year}`;
  } else {
    // shortDate: DD/MM/YYYY
    return `${pad(day)}/${pad(monthIdx + 1)}/${year}`;
  }
}

/**
 * Formats a billing period range for display.
 * E.g., start = "2026-09-01", end = "2026-09-30T23:59:59.999Z" -> "01/09/2026 – 30/09/2026"
 */
export function formatBillingPeriod(
  startDate: Date | string,
  endDate: Date | string,
  format: "shortDate" | "mediumDate" = "shortDate"
): string {
  const startStr = formatDateUTC(startDate, { format });
  const endStr = formatDateUTC(endDate, { format });
  if (!startStr) return "";
  if (!endStr || startStr === endStr) return startStr;
  return `${startStr} – ${endStr}`;
}
