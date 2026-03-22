import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Hong Kong Swimming Results & Rankings`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Search Hong Kong swimming competition results, track personal bests, and explore rankings across all age groups and events. 搜尋香港游泳比賽成績、個人最佳時間及各年齡組別排名。",
  applicationName: SITE_NAME,
  keywords: [
    "Hong Kong swimming",
    "HK swimming results",
    "HKASA",
    "swimming rankings",
    "age group swimming",
    "personal bests",
    "swim meet results",
    "香港游泳",
    "游泳比賽成績",
    "泳總",
    "分齡游泳",
  ],
  openGraph: {
    title: `${SITE_NAME} — Hong Kong Swimming Results & Rankings`,
    description:
      "Search Hong Kong swimming competition results, track personal bests, and explore rankings across all age groups and events.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    alternateLocale: "zh_HK",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Hong Kong Swimming Results & Rankings`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Hong Kong Swimming Results & Rankings`,
    description:
      "Search Hong Kong swimming competition results, track personal bests, and explore rankings.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: `${SITE_URL}/en`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})()`;


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-82EZZQGZHJ" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-82EZZQGZHJ');` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL,
              description:
                "Search Hong Kong swimming competition results, track personal bests, and explore rankings across all age groups and events.",
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/en/search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
              inLanguage: ["en", "zh-Hant-HK"],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
