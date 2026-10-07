import { chromium } from 'playwright';
import { config } from '../config.js';

async function testProverseConnection() {
  console.log('🔍 PROVERSE SAYTIGA ULANISH DIAGNOSTIKASI BOSHLANDI...\n');
  console.log(`🌐 Sayt manzili: ${config.proverse.baseUrl}`);
  console.log(`👤 Login: ${config.proverse.username}`);

  let browser = null;
  const diagnostics = {
    reachable: false,
    statusCode: null,
    loginFormFound: false,
    loginSuccessful: false,
    dashboardLoaded: false,
    errors: [],
    details: '',
  };

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    console.log('1. Saytga ulanish tekshirilmoqda...');
    const response = await page.goto(config.proverse.baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    }).catch(err => {
      diagnostics.errors.push(`Sayt ochilmadi: ${err.message}`);
      return null;
    });

    if (response) {
      diagnostics.reachable = true;
      diagnostics.statusCode = response.status();
      console.log(`✅ Sayt javob berdi! Status kodi: ${response.status()}`);
    }

    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`📌 Joriy sahifa URL: ${currentUrl}`);
    console.log(`📌 Sahifa sarlavhasi: ${pageTitle}`);

    // Login formani qidirish
    const usernameInput = page.locator('input[type="text"], input[type="email"], input[name="login"], input[name="email"], input[name="username"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Kirish"), button:has-text("Login")').first();

    if (await usernameInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      diagnostics.loginFormFound = true;
      console.log('✅ Login formasi topildi! Login va parol kiritilmoqda...');

      await usernameInput.fill(config.proverse.username);
      await passwordInput.fill(config.proverse.password);
      await submitButton.click();

      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);

      const postLoginUrl = page.url();
      const postLoginTitle = await page.title();
      console.log(`📌 Login bosilgandan keyingi URL: ${postLoginUrl}`);
      console.log(`📌 Login bosilgandan keyingi sahifa: ${postLoginTitle}`);

      // Guruhlar yoki Vazifalar sahifasi ko'rinyaptimi
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText.includes('Guruhlar') || bodyText.includes('Vazifalar') || bodyText.includes('Admin') || bodyText.includes('Dashboard')) {
        diagnostics.loginSuccessful = true;
        diagnostics.dashboardLoaded = true;
        console.log('🎉 TIZIMGA MUVAFFAQIYATLI KIRILDI VA BOSHQARUV PANELI KO\'RINDI!');
      } else {
        diagnostics.errors.push(`Login qilindi, lekin boshqaruv paneli aniqlanmadi (Sahifa matni: ${bodyText.slice(0, 150)}...)`);
      }
    } else {
      // Balki allaqachon dashboardda bo'lsa
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText.includes('Guruhlar') || bodyText.includes('Vazifalar')) {
        diagnostics.loginSuccessful = true;
        diagnostics.dashboardLoaded = true;
        console.log('✅ Allaqachon tizimga kirilgan holatda!');
      } else {
        diagnostics.errors.push("Login formasi sahifada topilmadi. Saytda himoya yoki boshqa tuzilma bo'lishi mumkin.");
      }
    }

  } catch (err) {
    diagnostics.errors.push(`Kutilmagan xatolik: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n--- DIAGNOSTIKA NATIJASI ---');
  console.log(JSON.stringify(diagnostics, null, 2));
  return diagnostics;
}

testProverseConnection();
