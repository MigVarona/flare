/**
 * Reminders are read at a glance, so a date is only useful if it reads like speech.
 * "Hoy, 20:00" lands; "13/07/2026 20:00" makes you do the maths.
 */
export function formatDueDate(date: Date) {
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (days === 0) return `Hoy, ${time}`;
  if (days === 1) return `Mañana, ${time}`;
  if (days === -1) return `Ayer, ${time}`;

  if (days > 1 && days < 7) {
    const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`;
  }

  const day = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

/** Whether a pending reminder's moment has already passed. */
export function isOverdue(date: Date) {
  return date.getTime() < Date.now();
}

export type RepeatFreq = 'daily' | 'weekly' | 'monthly';

export const RepeatLabel: Record<RepeatFreq, string> = {
  daily: 'Cada día',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
};

/**
 * The next time a repeating reminder is due, kept on the calendar rather than the clock.
 *
 * Moving by milliseconds (a day is 86 400 000 of them) drifts an hour across a DST change,
 * because a "day" isn't a fixed span of time — it's "the same clock reading, one date
 * later". `setDate`/`setMonth` ask for exactly that: they carry the hour and minute forward
 * unchanged and let the calendar do the counting.
 */
export function nextOccurrence(date: Date, freq: RepeatFreq): Date {
  const next = new Date(date);

  if (freq === 'daily') {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (freq === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  // Monthly has no fixed day count, so "the 31st, one month on" needs a landing that
  // exists: the day clamps to whatever the next month's last day actually is.
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const daysInNextMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInNextMonth));
  return next;
}
