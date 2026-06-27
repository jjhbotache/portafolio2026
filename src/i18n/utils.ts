import strings from './strings.json';

export type Lang = 'en' | 'es';

export const SUPPORTED_LOCALES: readonly Lang[] = ['en', 'es'];
export const DEFAULT_LOCALE: Lang = 'en';

export const isLang = (v: unknown): v is Lang =>
  v === 'en' || v === 'es';

const DICT = strings as Record<Lang, Record<string, unknown>>;

const format = (raw: string, vars?: Record<string, string>): string => {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
};

/**
 * Server-side translator. Resolves a JSON key for the given language and
 * substitutes `{placeholder}` tokens with values from `vars`.
 *
 * Falls back to the key itself when missing, so a typo never throws —
 * it just becomes visible in the UI which is easy to spot.
 */
export const t = (
  lang: Lang,
  key: string,
  vars?: Record<string, string>,
): string => {
  const raw = DICT[lang]?.[key] ?? DICT[DEFAULT_LOCALE]?.[key] ?? key;
  if (typeof raw !== 'string') {
    if (Array.isArray(raw)) return raw as unknown as string;
    return key;
  }
  return format(raw, vars);
};

/**
 * Reads the first path segment as the locale. Falls back to the default
 * locale when the path doesn't start with a supported prefix.
 */
export const getLangFromUrl = (url: URL): Lang => {
  const seg = url.pathname.split('/').filter(Boolean)[0];
  return isLang(seg) ? seg : DEFAULT_LOCALE;
};

/**
 * Replaces a locale prefix in a path. Useful for the language toggle.
 *
 *   swapLocaleInPath('/en/foo', 'es') -> '/es/foo'
 *   swapLocaleInPath('/foo', 'es')    -> '/es/foo'
 *   swapLocaleInPath('/', 'es')       -> '/es/'
 */
export const swapLocaleInPath = (path: string, next: Lang): string => {
  const stripped = path.replace(/^\/(en|es)(?=\/|$)/, '') || '/';
  const suffix = stripped === '/' ? '/' : stripped;
  return `/${next}${suffix}`.replace(/\/+/g, '/');
};

/**
 * Resolves a value that may be either a plain value or a bilingual
 * `{ en, es }` object into the value for the current language.
 *
 * Arrays are returned as-is (their inner elements may still be bilingual).
 * Strings and other primitives fall through unchanged.
 */
export const resolveBilingual = <T,>(
  value: T | { en?: T; es?: T } | null | undefined,
  lang: Lang,
): T | undefined => {
  if (value === null || value === undefined) return undefined;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('en' in (value as object) || 'es' in (value as object))
  ) {
    const obj = value as { en?: T; es?: T };
    return obj[lang] ?? obj.en ?? obj.es;
  }
  return value as T;
};