import type { Locale } from './config';

export function localizedPath(locale: Locale, path: string) {
  if (path.startsWith('http')) return path;
  if (path === '/') return `/${locale}`;
  return `/${locale}${path}`;
}