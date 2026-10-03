const FORMAT = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Data i godzina po polsku, np. "3 paź 2026, 14:30". Błędna data wraca bez zmian. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : FORMAT.format(date);
}
