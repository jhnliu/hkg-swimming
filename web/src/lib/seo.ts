import type { Metadata } from "next";
import type { Locale, Dict } from "./i18n";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hkgswimming.com";
export const SITE_NAME = "HKG Swimming";

export function alternatesForPath(path: string) {
  return {
    canonical: `${SITE_URL}/en${path}`,
    languages: {
      en: `${SITE_URL}/en${path}`,
      zh: `${SITE_URL}/zh${path}`,
      "x-default": `${SITE_URL}/en${path}`,
    },
  };
}

export function ogMeta({
  title,
  description,
  path,
  lang,
}: {
  title: string;
  description: string;
  path: string;
  lang: Locale;
}): Metadata["openGraph"] {
  return {
    title,
    description,
    url: `${SITE_URL}/${lang}${path}`,
    siteName: SITE_NAME,
    locale: lang === "zh" ? "zh_HK" : "en_US",
    type: "website",
  };
}

/** Build full Metadata for a static page that varies by language. */
export function localizedMeta({
  lang,
  dict,
  titleKey,
  descriptionKey,
  path,
}: {
  lang: Locale;
  dict: Dict;
  titleKey: string;
  descriptionKey: keyof Dict["seo"];
  path: string;
}): Metadata {
  const description = dict.seo[descriptionKey];
  return {
    title: titleKey,
    description,
    alternates: alternatesForPath(path),
    openGraph: ogMeta({ title: titleKey, description, path, lang }),
  };
}
