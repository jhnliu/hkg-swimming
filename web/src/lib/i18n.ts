export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

const dictionaries: Record<Locale, () => Promise<Dict>> = {
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
  zh: () => import("@/dictionaries/zh.json").then((m) => m.default),
};

export async function getDictionary(lang: Locale): Promise<Dict> {
  return dictionaries[lang]();
}

export interface Dict {
  nav: {
    home: string;
    swimmers: string;
    clubs: string;
    competitions: string;
    leaderboards: string;
    compare: string;
    trends: string;
    feedback: string;
  };
  home: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    recentCompetitions: string;
    viewAll: string;
  };
  swimmer: {
    personalBests: string;
    raceHistory: string;
    longCourse: string;
    shortCourse: string;
    club: string;
    age: string;
    competitions: string;
    results: string;
    firstCompeted: string;
    lastCompeted: string;
    event: string;
    time: string;
    date: string;
    rank: string;
  };
  competition: {
    results: string;
    event: string;
    venue: string;
    date: string;
    course: string;
    tier: string;
  };
  leaderboard: {
    title: string;
    filters: string;
    gender: string;
    ageGroup: string;
    stroke: string;
    distance: string;
    season: string;
    allTime: string;
  };
  feedback: {
    title: string;
    subtitle: string;
    submitTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    categoryLabel: string;
    titleLabel: string;
    titlePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    submitButton: string;
    thankYou: string;
    errorMissing: string;
    listTitle: string;
    openLabel: string;
    resolvedLabel: string;
    noItems: string;
  };
  common: {
    male: string;
    female: string;
    place: string;
    name: string;
    team: string;
    seedTime: string;
    finalsTime: string;
    noResults: string;
    loading: string;
    lc: string;
    sc: string;
    exportCsv: string;
  };
}
