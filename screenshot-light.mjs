const { chromium } = await import('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle', timeout: 15000 });

// Remove dark class and set light theme in localStorage
await page.evaluate(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('theme', 'light');
});
await page.waitForTimeout(500);

await page.screenshot({ path: 'screenshots/08-home-light.png' });

// Also do swimmer profile in light mode
await page.goto('http://localhost:3000/en/swimmer/20540', { waitUntil: 'networkidle', timeout: 15000 });
await page.evaluate(() => {
  document.documentElement.classList.remove('dark');
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/10-swimmer-light.png' });

await browser.close();
console.log('Done - light mode screenshots saved');
