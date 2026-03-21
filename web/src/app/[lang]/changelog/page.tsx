import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { localizedMeta } from "@/lib/seo";
import { readFile } from "fs/promises";
import path from "path";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale);
  return localizedMeta({
    lang: lang as Locale,
    dict,
    titleKey: dict.changelog.title,
    descriptionKey: "changelogDescription",
    path: "/changelog",
  });
}

interface ChangelogSection {
  title: string;
  items: string[];
}

interface ChangelogEntry {
  heading: string;
  sections: ChangelogSection[];
}

function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = markdown.split("\n");
  let currentEntry: ChangelogEntry | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = { heading: line.replace("## ", ""), sections: [] };
      currentSection = null;
    } else if (line.startsWith("### ") && currentEntry) {
      currentSection = { title: line.replace("### ", ""), items: [] };
      currentEntry.sections.push(currentSection);
    } else if (line.startsWith("- ") && currentSection) {
      currentSection.items.push(line.replace("- ", ""));
    } else if (line.startsWith("  - ") && currentSection) {
      currentSection.items.push(line.replace("  - ", "  "));
    }
  }
  if (currentEntry) entries.push(currentEntry);
  return entries;
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);

  const filename = lang === "zh" ? "changelog_user_zh.md" : "changelog_user.md";
  const changelogPath = path.join(process.cwd(), "public", filename);
  const markdown = await readFile(changelogPath, "utf-8");
  const entries = parseChangelog(markdown);

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {dict.changelog.title}
        </h1>
        <p className="mt-1 text-muted">{dict.changelog.subtitle}</p>
      </div>

      <div className="space-y-8">
        {entries.map((entry, i) => (
          <article
            key={i}
            className="rounded-lg border border-pool-border bg-surface p-5 dark:border-pool-border dark:bg-surface"
          >
            <h2 className="text-lg font-semibold text-pool-mid dark:text-pool-light">
              {entry.heading}
            </h2>

            {entry.sections.map((section, j) => (
              <div key={j} className="mt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {section.title}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {section.items.map((item, k) => {
                    const isIndented = item.startsWith("  ");
                    const text = isIndented ? item.trimStart() : item;
                    return (
                      <li
                        key={k}
                        className={`text-sm text-foreground/80 ${
                          isIndented ? "ml-5" : ""
                        }`}
                      >
                        <span className="mr-1.5 text-pool-mid dark:text-pool-light">
                          {isIndented ? "  " : ""}
                        </span>
                        {formatItem(text)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {entry.sections.length === 0 && (
              <p className="mt-2 text-sm text-foreground/70">
                {entry.heading}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function formatItem(text: string) {
  // Bold **text** and inline code `text`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-pool-surface px-1 py-0.5 font-mono text-xs text-pool-deep dark:bg-surface-alt dark:text-pool-light"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
