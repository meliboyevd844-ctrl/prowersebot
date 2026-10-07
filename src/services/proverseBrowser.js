import { chromium } from 'playwright';
import { config } from '../../config.js';

export class ProverseBrowserService {
  constructor() {
    this.baseUrl = config.proverse.baseUrl.replace(/\/admin$/, '').replace(/\/$/, '');
    this.adminUrl = `${this.baseUrl}/admin`;
    this.loginUrl = `${this.baseUrl}/admin/login`;
    this.username = config.proverse.username;
    this.password = config.proverse.password;
    this.headless = config.proverse.headless;
    this.browser = null;
    this.context = null;
    this.isLoggedIn = false;
    this.operationCount = 0;
    this.maxOperationsBeforeRecycle = 40;
    this.isInitializing = false;
  }

  async initBrowser() {
    // Agar brauzer ulanishi uzilgan bo'lsa yoki mavjud bo'lmasa qayta ishga tushirish
    if (!this.browser || !this.browser.isConnected()) {
      if (this.isInitializing) {
        // Parallel initsializatsiyani kutish
        while (this.isInitializing) {
          await new Promise(res => setTimeout(res, 100));
        }
        if (this.browser && this.browser.isConnected()) {
          return this.context;
        }
      }

      this.isInitializing = true;
      try {
        if (this.browser) {
          await this.browser.close().catch(() => {});
        }

        console.log('[ProVerse Browser] Yangi Chromium brauzer jarayoni ishga tushirilmoqda...');
        this.browser = await chromium.launch({
          headless: this.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ],
        });

        this.browser.on('disconnected', () => {
          console.warn('[ProVerse Browser] ⚠️ Chromium aloqasi uzildi. Keyingi so\'rovda yangisi ochiladi.');
          this.browser = null;
          this.context = null;
          this.isLoggedIn = false;
        });

        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        this.isLoggedIn = false;
        this.operationCount = 0;
      } finally {
        this.isInitializing = false;
      }
    }

    // Xotirani tozalash (RAM leak oldini olish uchun N ta amaldan so'ng qayta yuklash)
    this.operationCount++;
    if (this.operationCount > this.maxOperationsBeforeRecycle) {
      console.log(`[ProVerse Browser] ♻️ Xotirani tozalash uchun brauzer konteksti yangilanmoqda (${this.operationCount} ta amal bajarildi)...`);
      setImmediate(() => this.recycleContext());
    }

    return this.context;
  }

  async recycleContext() {
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
      if (this.browser && this.browser.isConnected()) {
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        this.isLoggedIn = false;
        this.operationCount = 0;
      }
    } catch (e) {
      console.warn('[ProVerse Browser] Kontekstni yangilashda ogohlantirish:', e.message);
    }
  }

  /**
   * Saytga ulanish va diagnostika qilish
   */
  async testConnection() {
    let page = null;
    const startTime = Date.now();
    try {
      console.log(`[Diagnostika] ProVerse saytiga ulanish tekshirilmoqda: ${this.loginUrl}`);
      const context = await this.initBrowser();
      page = await context.newPage();

      // 1. Saytga ulanish
      let response = null;
      try {
        response = await page.goto(this.loginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
      } catch (navErr) {
        const msg = navErr.message.toLowerCase();
        if (msg.includes('timeout')) {
          throw new Error("Sayt serveri (proverse.ct.ws) javob berish vaqti tugadi (Timeout). Server juda sekin ishlayapti yoki vaqtincha to'xtagan.");
        } else if (msg.includes('net::err_name_not_resolved') || msg.includes('enotfound')) {
          throw new Error("Sayt domeni (proverse.ct.ws) topilmadi! Internet aloqasi yoki domen nomini tekshiring.");
        } else if (msg.includes('net::err_connection_refused')) {
          throw new Error("Sayt serveri ulanishni rad etdi (Connection Refused). Server o'chirilgan bo'lishi mumkin.");
        } else {
          throw new Error(`Saytga ulanishda tarmoq xatoligi: ${navErr.message}`);
        }
      }

      const statusCode = response ? response.status() : 0;
      if (statusCode >= 400) {
        throw new Error(`Sayt ${statusCode} xatolik kodi bilan javob berdi (Sahifa topilmadi yoki server xatosi).`);
      }

      await page.waitForTimeout(1000);

      // Agar dashboardda bo'lsa
      const currentUrlBefore = page.url();
      if (currentUrlBefore.includes('/admin') && !currentUrlBefore.includes('/login')) {
        this.isLoggedIn = true;
        const pingTime = Date.now() - startTime;
        return {
          success: true,
          ping: pingTime,
          url: currentUrlBefore,
          message: "ProVerse saytiga muvaffaqiyatli ulandim! Tizim allaqachon faol holatda.",
        };
      }

      // 2. Login forma elementlarini tekshirish
      const usernameInput = page.locator('#admin-username, input[name="username"], input[type="text"]').first();
      const passwordInput = page.locator('#admin-password, input[name="password"], input[type="password"]').first();
      const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();

      const hasUsername = await usernameInput.isVisible({ timeout: 4000 }).catch(() => false);
      const hasPassword = await passwordInput.isVisible({ timeout: 4000 }).catch(() => false);

      if (!hasUsername || !hasPassword) {
        throw new Error("Sayt ochildi, lekin login/parol kiritish maydonchalari topilmadi. Sayt HTML tuzilishi o'zgargan bo'lishi mumkin.");
      }

      // 3. Login va parolni yuborish
      await usernameInput.fill(this.username);
      await passwordInput.fill(this.password);
      await submitBtn.click();

      // Natijani kutish
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      const pageTitle = await page.title();
      const pingTime = Date.now() - startTime;
      const bodyText = await page.textContent('body').catch(() => '');

      if (bodyText.includes('Login yoki parol') || bodyText.includes('noto\'g\'ri') || bodyText.includes('invalid') || bodyText.includes('Qolgan urinishlar')) {
        const errorMatch = bodyText.match(/Login yoki parol[^\.\n]+(?:\.[^\.\n]+)?/i)?.[0] || "Login yoki parol noto'g'ri.";
        throw new Error(`Sayt loginni rad etdi: "${errorMatch.trim()}". Iltimos, .env faylidagi PROVERSE_USERNAME va PROVERSE_PASSWORD ni tekshiring.`);
      }

      const isStillOnLogin = currentUrl.includes('/login') || await passwordInput.isVisible().catch(() => false);
      if (isStillOnLogin) {
        throw new Error(`ProVerse saytiga kirib bo'lmadi! Tizim login sahifasida qoldi. Kiritilgan login (${this.username}) yoki parol qabul qilinmadi.`);
      }

      this.isLoggedIn = true;
      return {
        success: true,
        ping: pingTime,
        url: currentUrl,
        title: pageTitle,
        message: "ProVerse saytiga muvaffaqiyatli ulandim!",
      };
    } catch (err) {
      this.isLoggedIn = false;
      return {
        success: false,
        error: err.message,
      };
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  /**
   * ProVerse saytiga kirish
   */
  async ensureLogin(page) {
    if (this.isLoggedIn) {
      return true;
    }

    try {
      console.log(`[ProVerse Browser] ProVerse tizimiga kirilmoqda: ${this.loginUrl}`);
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      const usernameInput = page.locator('#admin-username, input[name="username"], input[type="text"]').first();
      const passwordInput = page.locator('#admin-password, input[name="password"], input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();

      if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await usernameInput.fill(this.username);
        await passwordInput.fill(this.password);
        await submitButton.click();
        await page.waitForTimeout(2500);
      }

      const postUrl = page.url();
      const bodyContent = await page.textContent('body').catch(() => '');
      if (postUrl.includes('/login') || bodyContent.includes('Login yoki parol noto\'g\'ri') || await passwordInput.isVisible().catch(() => false)) {
        this.isLoggedIn = false;
        throw new Error(`ProVerse saytiga login qilib bo'lmadi! Login yoki parol noto'g'ri (Login: ${this.username}).`);
      }

      this.isLoggedIn = true;
      console.log(`[ProVerse Browser] ProVerse tizimiga muvaffaqiyatli kirildi.`);
      return true;
    } catch (err) {
      console.error(`[ProVerse Browser Xatolik] Login jarayonida xatolik:`, err.message);
      this.isLoggedIn = false;
      return false;
    }
  }

  /**
   * Vazifani ProVerse saytida o'quvchi uchun belgilash
   */
  async markAssignmentCompleted({ groupName, studentName, hashtag }) {
    let page = null;
    try {
      console.log(`[ProVerse Browser] Vazifani belgilash: Guruh: "${groupName}", O'quvchi: "${studentName}", Heshteg: "${hashtag}"`);
      const context = await this.initBrowser();
      page = await context.newPage();

      // 1. Kirishni tekshirish
      const loginOk = await this.ensureLogin(page);
      if (!loginOk) {
        throw new Error("ProVerse saytiga login qilib bo'lmadi (sayt javob bermayapti yoki login/parol xato)");
      }

      // 2. Vazifalar sahifasiga o'tish
      await page.goto(`${this.adminUrl}/vazifalar`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
        const vazifalarLink = page.locator('a:has-text("Vazifalar"), span:has-text("Vazifalar")').first();
        if (await vazifalarLink.isVisible()) {
          await vazifalarLink.click();
        }
      });

      await page.waitForTimeout(1000);

      // 3. Guruhni tanlash (agar mavjud bo'lsa)
      if (groupName) {
        const groupSelect = page.locator('select, div[role="combobox"]').first();
        if (await groupSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await groupSelect.selectOption({ label: groupName }).catch(() => {});
        }
      }

      // 4. Heshtegga mos vazifa kartasini topish
      const cleanTag = hashtag.replace(/^#/, '').toLowerCase();
      const cardSelector = `div:has-text("${cleanTag}"), tr:has-text("${cleanTag}"), .card:has-text("${cleanTag}")`;
      const card = page.locator(cardSelector).first();

      if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
        const checkBtn = card.locator('button:has-text("Tekshirish"), a:has-text("Tekshirish"), button:has-text("Ko\'rish")').first();
        if (await checkBtn.isVisible().catch(() => false)) {
          await checkBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // 5. O'quvchini qidirish va topshirgan deb belgilash
      const studentSearch = page.locator('input[placeholder*="O\'quvchi"], input[placeholder*="qidirish"], input[type="search"]').first();
      if (await studentSearch.isVisible({ timeout: 2000 }).catch(() => false)) {
        await studentSearch.fill(studentName);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
      }

      const studentRow = page.locator(`tr:has-text("${studentName}"), div:has-text("${studentName}")`).first();
      if (await studentRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        const toggleBtn = studentRow.locator('input[type="checkbox"], button:has-text("Bajarildi"), button:has-text("+"), .status-switch').first();
        if (await toggleBtn.isVisible().catch(() => false)) {
          const isChecked = await toggleBtn.isChecked().catch(() => false);
          if (!isChecked) {
            await toggleBtn.click();
            console.log(`[ProVerse Browser] "${studentName}" uchun vazifa belgilandi!`);
          }
        }
      }

      const saveBtn = page.locator('button:has-text("Saqlash"), button:has-text("Tasdiqlash")').first();
      if (await saveBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await saveBtn.click();
      }

      return {
        success: true,
        message: `ProVerse saytida ${studentName} uchun ${hashtag} muvaffaqiyatli belgilandi.`,
      };
    } catch (err) {
      console.error(`[ProVerse Browser Xatolik]:`, err.message);
      return {
        success: false,
        error: err.message,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * ProVerse saytidan ushbu guruh o'quvchilari ro'yxatini olish
   */
  async fetchStudentsFromProverse(groupName) {
    let page = null;
    try {
      console.log(`[ProVerse Browser] Guruh o'quvchilarini yuklash: "${groupName}"`);
      const context = await this.initBrowser();
      page = await context.newPage();

      const loginOk = await this.ensureLogin(page);
      if (!loginOk) {
        throw new Error("ProVerse saytiga login qilib bo'lmadi.");
      }

      // 1. Guruhlar sahifasiga o'tish
      await page.goto(`${this.adminUrl}/guruhlar`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
        const link = page.locator('a:has-text("Guruhlar")').first();
        if (await link.isVisible()) await link.click();
      });

      await page.waitForTimeout(1500);

      let studentNames = [];
      const cleanGroup = groupName ? groupName.toLowerCase() : '';
      const groupCard = page.locator(`div:has-text("${cleanGroup}"), tr:has-text("${cleanGroup}")`).first();

      if (await groupCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        const viewBtn = groupCard.locator('button:has-text("Ko\'rish"), a:has-text("Ko\'rish"), button:has-text("Jadval")').first();
        if (await viewBtn.isVisible().catch(() => false)) {
          await viewBtn.click();
          await page.waitForTimeout(1500);

          const rows = await page.locator('table tbody tr, .student-name, .student-card').allTextContents().catch(() => []);
          for (const row of rows) {
            const name = row.split('\n')[0].replace(/^\d+[\.\)]\s*/, '').trim();
            if (name && name.length >= 3 && !studentNames.includes(name)) {
              studentNames.push(name);
            }
          }
        }
      }

      // 2. Agar topilmasa, O'quvchilar umumiy bo'limidan olish
      if (studentNames.length === 0) {
        await page.goto(`${this.adminUrl}/oquvchilar`, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const rows = await page.locator('table tbody tr, .student-card').allTextContents().catch(() => []);
        for (const row of rows) {
          const name = row.split('\n')[0].replace(/^\d+[\.\)]\s*/, '').trim();
          if (name && name.length >= 3 && !studentNames.includes(name)) {
            studentNames.push(name);
          }
        }
      }

      console.log(`[ProVerse Browser] «${groupName}» guruhi uchun ${studentNames.length} ta o'quvchi olindi.`);
      return { success: true, students: studentNames };
    } catch (err) {
      console.warn(`[ProVerse Browser] O'quvchilarni yuklashda xatolik:`, err.message);
      return { success: false, error: err.message, students: [] };
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.isLoggedIn = false;
    }
  }
}
