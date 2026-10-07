import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export const config = {
  // Telegram Bot sozlamalari
  telegram: {
    botToken: (process.env.TELEGRAM_BOT_TOKEN || '').replace(/^["']|["']$/g, '').trim(),
    adminIds: (process.env.ADMIN_TELEGRAM_IDS || '')
      .replace(/^["']|["']$/g, '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean),
    // Bot admin login tizimi (faqat shu login/parolni biluvchi admingina botga kira oladi)
    botAdminUsername: (process.env.BOT_ADMIN_USERNAME || 'admin').trim(),
    botAdminPassword: (process.env.BOT_ADMIN_PASSWORD || 'admin123').trim(),
  },

  // ProVerse sayti integratsiyasi
  proverse: {
    baseUrl: (process.env.PROVERSE_BASE_URL || 'https://proverse.uz').replace(/^["']|["']$/g, '').replace(/\/$/, ''),
    authMode: (process.env.PROVERSE_AUTH_MODE || 'browser').replace(/^["']|["']$/g, '').toLowerCase().trim(),
    apiKey: (process.env.PROVERSE_API_KEY || '').replace(/^["']|["']$/g, '').trim(),
    username: (process.env.PROVERSE_USERNAME || '').replace(/^["']|["']$/g, '').trim(),
    password: (process.env.PROVERSE_PASSWORD || '').replace(/^["']|["']$/g, '').trim(),
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  },

  // Hisobot va jadval rejalashtirish sozlamalari
  schedule: {
    // Har Dushanba, Chorshanba, Juma soat 05:00 da: "0 5 * * 1,3,5"
    cronExpression: process.env.REPORT_CRON_SCHEDULE || '0 5 * * 1,3,5',
    timezone: process.env.TIMEZONE || 'Asia/Tashkent',
  },

  // Ma'lumotlar bazasi fayli joylashuvi
  database: {
    path: path.resolve(__dirname, 'data', 'proverse.json'),
  }
};

/**
 * Sozlamalarni tekshirish (Validation)
 */
export function validateConfig() {
  const errors = [];

  if (!config.telegram.botToken || config.telegram.botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    errors.push("TELEGRAM_BOT_TOKEN .env faylida o'rnatilmagan yoki noto'g'ri!");
  }

  if (config.proverse.authMode === 'api' && !config.proverse.apiKey) {
    errors.push("PROVERSE_AUTH_MODE=api qilib tanlangan, lekin PROVERSE_API_KEY kiritilmagan!");
  }

  if (config.proverse.authMode === 'browser' && (!config.proverse.username || !config.proverse.password)) {
    errors.push("PROVERSE_AUTH_MODE=browser qilib tanlangan, lekin PROVERSE_USERNAME yoki PROVERSE_PASSWORD kiritilmagan!");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
