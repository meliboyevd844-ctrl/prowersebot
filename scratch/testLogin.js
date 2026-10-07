import { ProverseBrowserService } from '../src/services/proverseBrowser.js';

async function test() {
  const b = new ProverseBrowserService();
  const ctx = await b.initBrowser();
  const p = await ctx.newPage();
  console.log('Opening login page...');
  await p.goto('https://proverse.ct.ws/admin/login', { waitUntil: 'domcontentloaded' });
  console.log('Initial URL:', p.url());
  console.log('Initial Title:', await p.title());

  const uInput = p.locator('#admin-username, input[name="username"], input[type="text"]').first();
  const pInput = p.locator('#admin-password, input[name="password"], input[type="password"]').first();
  const btn = p.locator('button[type="submit"], input[type="submit"]').first();

  await uInput.fill('aslbek');
  await pInput.fill('aslbek');
  await btn.click();
  await p.waitForTimeout(4000);

  console.log('After submit URL:', p.url());
  console.log('After submit Title:', await p.title());

  const bodyText = await p.textContent('body');
  console.log('Body snippet:', bodyText.substring(0, 300).replace(/\s+/g, ' '));

  await b.close();
  process.exit(0);
}

test().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
