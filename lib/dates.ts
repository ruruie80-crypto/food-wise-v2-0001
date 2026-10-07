const EPOCH_UTC = Date.UTC(2026, 0, 5);

export function weekId(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  return Math.floor((time - EPOCH_UTC) / (7 * 86400000));
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const time = new Date(Date.UTC(year, month - 1, day + days));
  const y = time.getUTCFullYear();
  const m = String(time.getUTCMonth() + 1).padStart(2, "0");
  const d = String(time.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function tokyoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function tokyoHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)];
}

export function formatMonthDay(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${month}月${day}日`;
}

export function formatShort(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${month}/${day}`;
}

export function formatWithWeekday(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${month}/${day}（${weekdayName(iso)}）`;
}

export function weekRangeLabel(iso: string): string {
  const dow = weekdayIndex(iso);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = addDays(iso, mondayOffset);
  const end = addDays(start, 6);
  return `${formatShort(start)}–${formatShort(end)}`;
}
