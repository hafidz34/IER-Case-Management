type ParsedDate = {
  d: number;
  m: number;
  y: number;
  time?: string; // HH:MM or HH:MM:SS
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidCalendarDate(y: number, m: number, d: number) {
  // m: 1..12, d: 1..31
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1000 || y > 9999) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseLoose(input: string): ParsedDate | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  // ISO date or datetime: 2025-12-13 or 2025-12-13T10:11:12 or 2025-12-13 10:11:12
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?$/);
  if (m) {
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const d = Number(m[3]);
    const time = m[4];
    if (!isValidCalendarDate(y, mm, d)) return null;
    return { d, m: mm, y, time };
  }

  // dd-mm-yyyy or dd/mm/yyyy (allow 1-2 digits for day/month)
  m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/);
  if (m) {
    const d = Number(m[1]);
    const mm = Number(m[2]);
    const y = Number(m[3]);
    const time = m[4];
    if (!isValidCalendarDate(y, mm, d)) return null;
    return { d, m: mm, y, time };
  }

  return null;
}

export function formatDDMMYYYY(d: number, m: number, y: number) {
  return `${pad2(d)}-${pad2(m)}-${y}`;
}

export function normalizeDateTimeDisplay(input?: string | null): string {
  const raw = (input ?? "").toString();
  const p = parseLoose(raw);
  if (!p) return raw;
  const base = formatDDMMYYYY(p.d, p.m, p.y);
  return p.time ? `${base} ${p.time}` : base;
}

export function normalizeDateDisplay(input?: string | null): string {
  const p = parseLoose(String(input ?? ""));
  if (!p) return (input ?? "").toString();
  // display dates without time
  return formatDDMMYYYY(p.d, p.m, p.y);
}

export function normalizeDateForPayload(input?: string | null): string | null {
  const raw = (input ?? "").toString().trim();
  if (!raw) return null;

  const p = parseLoose(raw);
  if (!p) return null;

  // payload prefers dd-mm-yyyy (no time)
  return formatDDMMYYYY(p.d, p.m, p.y);
}

export function displayDateOrDash(input?: string | null): string {
  if (!input) return "-";
  const p = parseLoose(String(input));
  if (!p) return String(input);
  return formatDDMMYYYY(p.d, p.m, p.y);
}

export function displayDateTimeOrDash(input?: string | null): string {
  if (!input) return "-";
  const p = parseLoose(String(input));
  if (!p) return String(input);
  const base = formatDDMMYYYY(p.d, p.m, p.y);
  return p.time ? `${base} ${p.time}` : base;
}

export function isValidDateInput(input?: string | null): boolean {
  const raw = (input ?? "").toString().trim();
  if (!raw) return true; // empty is allowed in this app
  return parseLoose(raw) !== null;
}
