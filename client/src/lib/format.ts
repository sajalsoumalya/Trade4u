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
