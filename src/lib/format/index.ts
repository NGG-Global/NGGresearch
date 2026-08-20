/**
 * Every number, percentage, duration and date shown in the UI goes through this
 * module. Centralising it keeps the analytics readable and keeps LTR figures
 * from being mangled by the RTL layout.
 */

const HEBREW_LOCALE = 'he-IL';

/** 412K / 52.8K / 1.2M — the compact style used throughout the design. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimZero(value / 1_000_000, 1)}M`;
  if (abs >= 1_000) {
    const thousands = value / 1_000;
    return `${Math.abs(thousands) >= 100 ? Math.round(thousands).toString() : trimZero(thousands, 1)}K`;
  }
  return formatInteger(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat(HEBREW_LOCALE, { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat(HEBREW_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** A percentage already expressed in percent units (51 → "51%"). */
export function formatPercent(value: number, digits = 1): string {
  return `${digits === 0 ? Math.round(value).toString() : trimZero(value, digits)}%`;
}

/** Seconds → 7:41, or 1:02:15 past the hour. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}

/** Watch time is stored in minutes; the UI shows hours, compacted. */
export function formatWatchHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 1_000) return formatCompact(hours);
  if (hours >= 10) return formatInteger(hours);
  return formatDecimal(hours, 1);
}

/** 12.3.26 — the short date form used in the design's tables. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const year = date.getFullYear().toString().slice(-2);
  return `${date.getDate()}.${date.getMonth() + 1}.${year}`;
}

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(HEBREW_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(HEBREW_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** "לפני 12 דקות" / "לפני 3 ימים" — Hebrew relative age. */
export function formatRelativeAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60_000));

  if (minutes < 1) return 'עכשיו';
  if (minutes === 1) return 'לפני דקה';
  if (minutes < 60) return `לפני ${minutes} דקות`;

  const hours = Math.round(minutes / 60);
  if (hours === 1) return 'לפני שעה';
  if (hours < 24) return `לפני ${hours} שעות`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'לפני יום';
  if (days < 30) return `לפני ${days} ימים`;

  const months = Math.round(days / 30);
  if (months === 1) return 'לפני חודש';
  if (months < 12) return `לפני ${months} חודשים`;

  const years = Math.round(months / 12);
  return years === 1 ? 'לפני שנה' : `לפני ${years} שנים`;
}

/** Age of a video expressed in the units that matter at that stage. */
export function formatVideoAge(ageHours: number): string {
  if (ageHours < 1) return 'פחות משעה';
  if (ageHours < 48) {
    const hours = Math.round(ageHours);
    return hours === 1 ? 'שעה' : `${hours} שעות`;
  }
  const days = Math.round(ageHours / 24);
  if (days < 30) return `${days} ימים`;
  const months = Math.round(days / 30);
  return months === 1 ? 'חודש' : `${months} חודשים`;
}

/** Signed percentage difference: "+32%" / "-8%". */
export function formatSignedPercent(value: number, digits = 0): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const magnitude = digits === 0 ? Math.round(Math.abs(value)).toString() : trimZero(Math.abs(value), digits);
  return `${sign}${magnitude}%`;
}

/** "▲ 0.9" / "▼ 0.4" — the delta chips in the design's metric cards. */
export function formatDeltaChip(value: number, digits = 1): string {
  if (value === 0) return `— ${trimZero(0, digits)}`;
  const arrow = value > 0 ? '▲' : '▼';
  return `${arrow} ${trimZero(Math.abs(value), digits)}`;
}

function trimZero(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
