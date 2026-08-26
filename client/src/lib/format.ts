const TZ = 'Asia/Kolkata';
const LOCALE = 'en-IN';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { timeZone: TZ });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { timeZone: TZ });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { timeZone: TZ });
}

/**
 * Position size, trimmed for display.
 *
 * Quantities are derived as tradeAmount / price, so they arrive as long
 * binary-float tails (0.010000000000000002). Show enough precision for a
 * low-priced asset without printing the artefact.
 */
export function formatQuantity(qty: number): string {
  if (!Number.isFinite(qty)) return '--';
  if (qty === 0) return '0';
  if (Math.abs(qty) >= 1000) return qty.toLocaleString(LOCALE, { maximumFractionDigits: 2 });
  return parseFloat(qty.toPrecision(6)).toString();
}

/** Price with the usual 2 decimals, or more for sub-dollar assets. */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '--';
  return Math.abs(price) >= 1
    ? price.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toFixed(6);
}
