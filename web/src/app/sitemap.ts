import type { MetadataRoute } from "next";
import { getCompetitions, getClubs } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [competitions, clubs, swimmerRows] = await Promise.all([
    getCompetitions(),
    getClubs(),
    sql`SELECT DISTINCT swimmer_id FROM results`,
  ]);

  const staticPages = [
    "",
    "/clubs",
    "/competitions",
    "/leaderboards",
    "/search",
    "/compare",
    "/trends",
    "/feedback",
  ];

  const entries: MetadataRoute.Sitemap = [];

  // Static pages — both languages
  for (const path of staticPages) {
    entries.push({
      url: `${SITE_URL}/en${path}`,
      changeFrequency: path === "" ? "daily" : "weekly",
      priority: path === "" ? 1.0 : 0.7,
      alternates: {
        languages: {
          en: `${SITE_URL}/en${path}`,
          zh: `${SITE_URL}/zh${path}`,
        },
      },
    });
  }

  // Competition pages
  for (const comp of competitions) {
    entries.push({
      url: `${SITE_URL}/en/competition/${comp.id}`,
      lastModified: comp.date,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: {
          en: `${SITE_URL}/en/competition/${comp.id}`,
          zh: `${SITE_URL}/zh/competition/${comp.id}`,
        },
      },
    });
  }

  // Club pages
  for (const club of clubs) {
    entries.push({
      url: `${SITE_URL}/en/club/${club.code}`,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: {
          en: `${SITE_URL}/en/club/${club.code}`,
          zh: `${SITE_URL}/zh/club/${club.code}`,
        },
      },
    });
  }

  // Swimmer pages
  for (const row of swimmerRows) {
    const id = encodeURIComponent(row.swimmer_id);
    entries.push({
      url: `${SITE_URL}/en/swimmer/${id}`,
      changeFrequency: "weekly",
      priority: 0.5,
      alternates: {
        languages: {
          en: `${SITE_URL}/en/swimmer/${id}`,
          zh: `${SITE_URL}/zh/swimmer/${id}`,
        },
      },
    });
  }

  return entries;
}
