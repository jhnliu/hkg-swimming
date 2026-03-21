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
    appeals: string;
    changelog: string;
    team: string;
    interSchool: string;
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
    searchPlaceholder: string;
    filterByEvent: string;
    allEvents: string;
    showAll: string;
    collapseAll: string;
    noMatches: string;
    loadingResults: string;
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
  appeals: {
    title: string;
    subtitle: string;
    submitTitle: string;
    typeCorrection: string;
    typeMissing: string;
    typeCorrectionDesc: string;
    typeMissingDesc: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    swimmerNameLabel: string;
    swimmerNamePlaceholder: string;
    swimmerIdLabel: string;
    swimmerIdPlaceholder: string;
    competitionLabel: string;
    competitionPlaceholder: string;
    eventLabel: string;
    eventPlaceholder: string;
    recordedTimeLabel: string;
    recordedTimePlaceholder: string;
    missingSwimmerPlaceholder: string;
    missingCompetitionPlaceholder: string;
    missingEventPlaceholder: string;
    missingTimePlaceholder: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    missingReasonPlaceholder: string;
    requestedChangeLabel: string;
    requestedChangePlaceholder: string;
    missingRequestedChangePlaceholder: string;
    submitButton: string;
    thankYou: string;
    errorMissing: string;
    listTitle: string;
    pendingLabel: string;
    approvedLabel: string;
    rejectedLabel: string;
    correctionLabel: string;
    missing_recordLabel: string;
    gender_correctionLabel: string;
    typeGender: string;
    typeGenderDesc: string;
    genderCurrentLabel: string;
    genderCorrectLabel: string;
    noItems: string;
    adminNote: string;
    reviewedAt: string;
  };
  changelog: {
    title: string;
    subtitle: string;
  };
  interSchool: {
    title: string;
    subtitle: string;
    competitions: string;
    leaderboards: string;
    rankings: string;
    school: string;
    division: string;
    season: string;
    ageGroup: string;
    allDivisions: string;
    allSeasons: string;
    gold: string;
    silver: string;
    bronze: string;
    totalPoints: string;
    points: string;
    record: string;
    schoolResults: string;
    topPerformers: string;
    medals: string;
    gradeA: string;
    gradeB: string;
    gradeC: string;
  };
  seo: {
    siteDescription: string;
    clubsDescription: string;
    competitionsDescription: string;
    leaderboardsDescription: string;
    searchDescription: string;
    compareDescription: string;
    trendsDescription: string;
    feedbackDescription: string;
    changelogDescription: string;
    swimmerDescription: string;
    competitionDescription: string;
    clubDescription: string;
    longCourse: string;
    shortCourse: string;
    interSchoolDescription: string;
    interSchoolRankingsDescription: string;
    interSchoolLeaderboardsDescription: string;
  };
  team: {
    title: string;
    subtitle: string;
    addToTeam: string;
    removeFromTeam: string;
    addedToTeam: string;
    emptyTeam: string;
    saveTeam: string;
    loadTeam: string;
    teamCode: string;
    teamCodePlaceholder: string;
    teamCodeHint: string;
    teamName: string;
    teamNamePlaceholder: string;
    saved: string;
    loaded: string;
    notFound: string;
    invalidCode: string;
    shareLink: string;
    clearTeam: string;
    clearConfirm: string;
    swimmers: string;
    codeTaken: string;
    lc: string;
    sc: string;
    noPbs: string;
    howItWorks: string;
    instruction1: string;
    instruction2: string;
    instruction3: string;
  };
  common: {
    male: string;
    female: string;
    place: string;
    name: string;
    team: string;
    seedTime: string;
    finalsTime: string;
    heatTime: string;
    noResults: string;
    loading: string;
    lc: string;
    sc: string;
    exportCsv: string;
  };
}
