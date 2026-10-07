import { chromium } from 'playwright';

const urlsToTest = [
  'https://proverse.ct.ws',
  'https://proverse.ct.ws/login',
  'https://proverse.ct.ws/admin/login',
  'https://proverse.ct.ws/auth/login',
  'https://proverse.ct.ws/index.php',
];

async function scanUrls() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of urlsToTest) {
    try {
      console.log(`Sinab ko'rilmoqda: ${url}`);
      const res = await page.goto(url, { timeout: 15000 });
      const title = await page.title();
      const currentUrl = page.url();
      const hasInputs = await page.locator('input').count();
      console.log(` -> Natija: Status: ${res?.status()}, Title: "${title}", URL: ${currentUrl}, Inputs: ${hasInputs}`);
    } catch (e) {
      console.log(` -> Xato: ${e.message}`);
    }
  }

  await browser.close();
}

scanUrls();
