import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://hkg-swimming.vercel.app';
const OUT = './screenshots';
mkdirSync(OUT, { recursive: true });

const shots = [
  // Desktop (1280x800)
  { name: '01-home-desktop', url: '/en', viewport: { width: 1280, height: 800 } },
  { name: '02-swimmer-profile', url: '/en/swimmer/20540', viewport: { width: 1280, height: 800 } },
  { name: '03-leaderboards', url: '/en/leaderboards', viewport: { width: 1280, height: 800 } },
  { name: '04-compare', url: '/en/compare?q1=Chan&s1=20540&q2=Wong&s2=30192', viewport: { width: 1280, height: 800 } },
  { name: '05-trends', url: '/en/trends', viewport: { width: 1280, height: 800 } },
  { name: '06-club', url: '/en/club/SCA', viewport: { width: 1280, height: 800 } },
  { name: '07-competition', url: '/en/competitions', viewport: { width: 1280, height: 800 } },
  // Dark mode
  { name: '08-home-dark', url: '/en', viewport: { width: 1280, height: 800 }, dark: true },
  // Mobile
  { name: '09-home-mobile', url: '/en', viewport: { width: 390, height: 844 } },
  { name: '10-swimmer-mobile', url: '/en/swimmer/20540', viewport: { width: 390, height: 844 } },
];

async function run() {
  const browser = await chromium.launch();

  for (const shot of shots) {
    console.log(`📸 ${shot.name}...`);
    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: 2, // retina quality
      ...(shot.dark ? { colorScheme: 'dark' } : {}),
    });
    const page = await context.newPage();

    await page.goto(`${BASE}${shot.url}`, { waitUntil: 'networkidle', timeout: 30000 });

    // For dark mode, click the theme toggle
    if (shot.dark) {
      try {
        // Try clicking the theme toggle button
        await page.click('button[aria-label]', { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(500);
      } catch (e) {}
    }

    // Wait for any animations/transitions
    await page.waitForTimeout(1000);

    // Full page screenshot for pages with scrollable content
    const fullPage = ['02-swimmer-profile', '06-club'].some(n => shot.name.includes(n));

    await page.screenshot({
      path: `${OUT}/${shot.name}.png`,
      fullPage,
    });

    await context.close();
  }

  await browser.close();
  console.log(`\n✅ Done! Screenshots saved to ${OUT}/`);
}

run().catch(console.error);
