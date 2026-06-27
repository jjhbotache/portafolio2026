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
 * Browser-side translator. Same semantics as `t()` from `./utils.ts` but
 * lives in a separate module so it's safe to ship as a small client bundle
 * (the server version can keep growing without affecting the client).
 */
export const clientT = (
  lang: Lang,
  key: string,
  vars?: Record<string, string>,
): string => {
  const raw = DICT[lang]?.[key] ?? DICT[DEFAULT_LOCALE]?.[key] ?? key;
  if (typeof raw !== 'string') {
    if (Array.isArray(raw)) return (raw as unknown as string);
    return key;
  }
  return format(raw, vars);
};

/**
 * Walks the DOM and updates every element carrying `data-lang`,
 * `data-i18n` or `data-i18n-attr="..."` so it matches `lang`. Safe to call
 * at any time; no-ops when no element matches.
 *
 * - `[data-lang]` toggles the `hidden` class so only the matching language
 *   variant stays visible.
 * - `[data-i18n]` has its text content replaced with the resolved string.
 * - `[data-i18n-attr]` updates attributes listed as `attr:key,attr:key`.
 */
export const applyLangToDOM = (lang: Lang): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;

  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((el) => {
    el.classList.toggle('hidden', el.dataset.lang !== lang);
  });

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    el.textContent = clientT(lang, key);
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    const spec = el.dataset.i18nAttr;
    if (!spec) return;
    spec.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key) return;
      el.setAttribute(attr, clientT(lang, key));
    });
  });
};