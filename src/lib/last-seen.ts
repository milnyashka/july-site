export function formatLastSeen(
  iso: string | null | undefined,
  locale: 'ru' | 'en',
  labels: { online: string; justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string; unknown: string }
): string {
  if (!iso) return labels.unknown;

  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - then) / 60_000);

  if (diffMin < 3) return labels.online;
  if (diffMin < 1) return labels.justNow;
  if (diffMin < 60) return labels.minutesAgo.replace('{n}', String(diffMin));

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return labels.hoursAgo.replace('{n}', String(diffHours));

  const diffDays = Math.floor(diffHours / 24);
  return labels.daysAgo.replace('{n}', String(diffDays));
}