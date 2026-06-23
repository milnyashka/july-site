import type { Locale } from './config';
import { en } from './dictionaries/en';
import { ru } from './dictionaries/ru';

const dictionaries = { en, ru };

export async function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export type Dictionary = typeof en;