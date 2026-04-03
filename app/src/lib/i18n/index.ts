import tr from './tr';
import en from './en';

export type Lang = 'tr' | 'en';

const translations: Record<Lang, Record<string, string>> = { tr, en };

/** All registered languages — add a new entry here to support a new language */
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'tr', label: 'TR' },
  { code: 'en', label: 'EN' },
];

/** Translate a key with optional variable interpolation: {name}, {n}, etc. */
export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = translations[lang];
  // Fall back to 'tr' if key missing in current lang
  let str = dict[key] ?? translations.tr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
