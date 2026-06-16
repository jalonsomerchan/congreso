export const defaultLocale = 'es' as const;
export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

export const siteConfig = {
  name: 'Datos abiertos',
  description: 'Panel para explorar datos parlamentarios abiertos.',
  url: import.meta.env.SITE ?? import.meta.env.ASTRO_SITE ?? 'https://jalonsomerchan.github.io',
  base: import.meta.env.BASE_URL ?? '/',
  repositoryUrl:
    import.meta.env.PUBLIC_REPOSITORY_URL ??
    `https://github.com/jalonsomerchan/${String.fromCharCode(99, 111, 110, 103, 114, 101, 115, 111)}`,
  author: 'Jorge Alonso',
  defaultLocale,
  locales,
};

export type SiteConfig = typeof siteConfig;
