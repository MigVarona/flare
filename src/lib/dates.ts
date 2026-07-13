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
