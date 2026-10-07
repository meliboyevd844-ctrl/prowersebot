import { chromium } from 'playwright';

async function testAdminLogin() {
  console.log('🔐 https://proverse.ct.ws/admin/login ga kirish sinovi...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://proverse.ct.ws/admin/login', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Login sahifasi ochildi. Sarlavha:', await page.title());

    // Inputlarni ko'rish
    const inputs = await page.$$eval('input', els => els.map(el => ({
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      id: el.id
    })));
    console.log('Sahifadagi inputlar:', inputs);

    // Login va parol to'ldirish
    const usernameInput = page.locator('input[type="text"], input[name="username"], input[name="login"], input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();

    await usernameInput.fill('aslbek');
    await passwordInput.fill('aslbek');
    console.log('Login va parol kiritildi, "Kirish" tugmasi bosilmoqda...');

    await submitBtn.click();
    await page.waitForTimeout(5000);

    const postUrl = page.url();
    const postTitle = await page.title();
    console.log('📌 Yangi URL:', postUrl);
    console.log('📌 Yangi Sahifa Sarlavhasi:', postTitle);

    const bodySnippet = await page.textContent('body');
    if (bodySnippet.includes('Guruhlar') || bodySnippet.includes('Vazifalar') || bodySnippet.includes('Admin Panel') || postUrl.includes('/admin/')) {
      console.log('🎉 TABRIKLAYMIZ! LOGIN MUVAFFAQIYATLI BO\'LDI!');
    } else {
      console.log('Sahifa mazmuni:', bodySnippet.slice(0, 200));
    }
  } catch (err) {
    console.error('Xatolik:', err.message);
  } finally {
    await browser.close();
  }
}

testAdminLogin();
