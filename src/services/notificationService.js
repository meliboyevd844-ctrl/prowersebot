import { config } from '../../config.js';

export class NotificationService {
  constructor(bot) {
    this.bot = bot;
    this.recentAlerts = new Map(); // alertKey -> timestamp
    this.throttleTimeMs = 60 * 1000; // 1 daqiqa ichida bir xil xatoni qayta yubormaslik
  }

  /**
   * Administratorlarga xatolik yoki sayt muammolari haqida ogohlantirish yuborish
   */
  async notifyError(title, errorDetail, extraInfo = {}) {
    const adminIds = config.telegram.adminIds;
    if (!adminIds || adminIds.length === 0) {
      console.warn('[NotificationService] ADMIN_TELEGRAM_IDS sozlanmagan, xatolik faqat konsolga yozildi.');
      return;
    }

    const errStr = typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : String(errorDetail);
    const alertKey = `${title}:${errStr.substring(0, 50)}:${extraInfo.groupName || ''}`;
    const now = Date.now();

    // Bir xil xatolik tez-tez takrorlansa adminga spam qilmaslik
    if (this.recentAlerts.has(alertKey)) {
      const lastSent = this.recentAlerts.get(alertKey);
      if (now - lastSent < this.throttleTimeMs) {
        return;
      }
    }
    this.recentAlerts.set(alertKey, now);

    // Eski keshlarni tozalash (Memory leak oldini olish)
    if (this.recentAlerts.size > 200) {
      for (const [key, ts] of this.recentAlerts.entries()) {
        if (now - ts > this.throttleTimeMs * 5) {
          this.recentAlerts.delete(key);
        }
      }
    }

    const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let message = `⚠️ <b>TIZIM OGOHLANTIRISHI / XATOLIK</b>\n\n` +
      `🕒 <b>Vaqt:</b> ${time}\n` +
      `📌 <b>Bo'lim:</b> ${title}\n` +
      `❌ <b>Xatolik:</b> <code>${errStr.substring(0, 300)}</code>\n`;

    if (extraInfo.groupName) {
      message += `🏢 <b>Guruh:</b> ${extraInfo.groupName}\n`;
    }
    if (extraInfo.studentName) {
      message += `👤 <b>O'quvchi:</b> ${extraInfo.studentName}\n`;
    }
    if (extraInfo.hashtag) {
      message += `🏷️ <b>Heshteg:</b> ${extraInfo.hashtag}\n`;
    }

    message += `\n💡 <i>Bot vazifani lokal bazada saqlab qoldi va sayt bilan aloqa qayta tiklanganda avtomatik ravishda saytga belgilaydi.</i>`;

    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, message, { parse_mode: 'HTML' });
        await new Promise(r => setTimeout(r, 100)); // Rate limit himoyasi
      } catch (err) {
        console.error(`[NotificationService] Admin (${adminId}) ga xabar yuborishda xatolik:`, err.message);
      }
    }
  }

  /**
   * Sayt qayta tiklanganda yoki muvaffaqiyatli sinxronizatsiya haqida xabar
   */
  async notifySuccess(title, messageText) {
    const adminIds = config.telegram.adminIds;
    if (!adminIds || adminIds.length === 0) return;

    const message = `✅ <b>TIZIM XABARI: ${title}</b>\n\n${messageText}`;
    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, message, { parse_mode: 'HTML' });
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`[NotificationService] Admin (${adminId}) ga xabar yuborishda xatolik:`, err.message);
      }
    }
  }
}
