import { config } from '../../config.js';
import { db } from '../database/db.js';

// Tasdiqlangan adminlar (telegramUserId -> true/false)
const verifiedAdmins = new Map();
// Kutayotganlar (telegramUserId -> { step: 'awaiting_username' | 'awaiting_password', timestamp: number })
const loginState = new Map();
// Kiritilgan username (telegramUserId -> string)
const pendingUsername = new Map();

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 daqiqa

export class AdminAuth {
  /**
   * Ushbu Telegram foydalanuvchi tasdiqlangan adminmi?
   */
  static isVerified(telegramUserId) {
    const id = String(telegramUserId);
    if (verifiedAdmins.get(id) === true) {
      return true;
    }
    const persisted = db.data?.settings?.verifiedAdmins || [];
    if (persisted.includes(id)) {
      verifiedAdmins.set(id, true);
      return true;
    }
    return false;
  }

  /**
   * Login jarayonini boshlash
   */
  static startLogin(telegramUserId) {
    const id = String(telegramUserId);
    loginState.set(id, { step: 'awaiting_username', timestamp: Date.now() });
    pendingUsername.delete(id);
  }

  /**
   * Login jarayonida xabarni qayta ishlash
   */
  static processLoginStep(telegramUserId, text) {
    const id = String(telegramUserId);
    const session = loginState.get(id);

    if (!session) return { handled: false };

    // Timeout tekshiruvi (5 daqiqadan oshsa tozalash)
    if (Date.now() - session.timestamp > LOGIN_TIMEOUT_MS) {
      loginState.delete(id);
      pendingUsername.delete(id);
      return {
        handled: true,
        success: false,
        step: 'timeout',
        message: `⏳ <b>Kirish vaqti tugadi.</b>\n\nQaytadan boshlash uchun <b>/login</b> buyrug'ini yuboring.`,
      };
    }

    if (session.step === 'awaiting_username') {
      pendingUsername.set(id, text.trim());
      loginState.set(id, { step: 'awaiting_password', timestamp: Date.now() });
      return {
        handled: true,
        success: false,
        step: 'awaiting_password',
        message: `🔒 <b>Foydalanuvchi qabul qilindi.</b>\n\nEndi parolni kiriting:`,
      };
    }

    if (session.step === 'awaiting_password') {
      const enteredUsername = pendingUsername.get(id) || '';
      const enteredPassword = text.trim();

      const correctUsername = config.telegram.botAdminUsername;
      const correctPassword = config.telegram.botAdminPassword;

      loginState.delete(id);
      pendingUsername.delete(id);

      if (enteredUsername === correctUsername && enteredPassword === correctPassword) {
        verifiedAdmins.set(id, true);

        // Bazada saqlab qo'yish
        db.data.settings = db.data.settings || {};
        db.data.settings.verifiedAdmins = db.data.settings.verifiedAdmins || [];
        if (!db.data.settings.verifiedAdmins.includes(id)) {
          db.data.settings.verifiedAdmins.push(id);
          db.save();
        }

        return {
          handled: true,
          success: true,
          step: 'done',
          message: `✅ <b>Muvaffaqiyatli kirdingiz!</b>\n\nXush kelibsiz, Admin! Barcha boshqaruv menyulari va buyruqlar faollashtirildi. 🚀`,
        };
      } else {
        return {
          handled: true,
          success: false,
          step: 'failed',
          message: `❌ <b>Login yoki parol noto'g'ri!</b>\n\nQaytadan urinish uchun <b>/login</b> buyrug'ini yuboring.`,
        };
      }
    }

    return { handled: false };
  }

  /**
   * Adminni tizimdan chiqarish
   */
  static logout(telegramUserId) {
    const id = String(telegramUserId);
    verifiedAdmins.delete(id);
    loginState.delete(id);
    pendingUsername.delete(id);

    if (db.data?.settings?.verifiedAdmins) {
      db.data.settings.verifiedAdmins = db.data.settings.verifiedAdmins.filter(adminId => adminId !== id);
      db.save();
    }
  }

  /**
   * Login jarayoni kutayotganmi?
   */
  static isInLoginFlow(telegramUserId) {
    const id = String(telegramUserId);
    const session = loginState.get(id);
    if (!session) return false;
    if (Date.now() - session.timestamp > LOGIN_TIMEOUT_MS) {
      loginState.delete(id);
      pendingUsername.delete(id);
      return false;
    }
    return true;
  }
}
