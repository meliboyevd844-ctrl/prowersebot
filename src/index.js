import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { config, validateConfig } from '../config.js';
import { createBot } from './bot/bot.js';
import { db } from './database/db.js';
import { SchedulerService } from './services/scheduler.js';
import { proverseService } from './services/proverseService.js';

// Global xatoliklarni ushlab olish (Node.js jarayoni hech qachon to'xtab qolmasligi uchun)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Global Himoya] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Global Himoya] Uncaught Exception:', err.message, err.stack);
});

async function launchWithRetry(bot, maxRetries = 15, delayMs = 4000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Telegram] Ulanishga urinish (${attempt}/${maxRetries})...`);
      
      await bot.launch(() => {
        console.log('✅ TELEGRAM BOT MUVAFFAQIYATLI ISHGA TUSHDI VA XABARLARNI KUTMOQDA!');
      });
      return true;
    } catch (err) {
      console.warn(`⚠️ [Telegram Ulanish Xatolik (${attempt})]: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`⏳ ${delayMs / 1000} soniyadan so'ng qayta ulaniladi...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error('❌ Telegram bilan ulanish tiklanmadi, orqa fonda qayta urinish davom etadi...');
        // To'xtab qolmasdan 10 soniyadan so'ng qayta urinish
        setTimeout(() => launchWithRetry(bot, maxRetries, delayMs), 10000);
      }
    }
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 PROVERSE TELEGRAM BOT TIZIMI ISHGA TUSHMOQDA...');
  console.log('====================================================\n');

  // 1. Konfiguratsiyani tekshirish
  const validation = validateConfig();
  if (!validation.isValid) {
    console.warn('⚠️  DIQQAT! Sozlamalarda quyidagi kamchiliklar mavjud:');
    validation.errors.forEach(err => console.warn(`   - ${err}`));
    console.log('\n💡 Iltimos, .env faylini oching va to\'g\'ri qiymatlarni kiriting.\n');
  }

  console.log(`📡 ProVerse ulanish rejimi: [${config.proverse.authMode.toUpperCase()}]`);
  console.log(`🌐 ProVerse manzili: ${config.proverse.baseUrl}`);
  console.log(`⏰ Standart hisobot jadvali: "${config.schedule.cronExpression}" (${config.schedule.timezone})\n`);

  if (!config.telegram.botToken || config.telegram.botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.error('❌ Xatolik: Bot token kiritilmagan. Botni ishga tushirish uchun .env fayliga TELEGRAM_BOT_TOKEN ni kiriting.');
    return;
  }

  try {
    // 2. Botni yaratish
    const bot = createBot();

    // 3. Rejalashtiruvchini (Cron) ishga tushirish
    const scheduler = new SchedulerService(bot);
    scheduler.start();

    // 4. Botni avtomatik qayta urinish bilan ishga tushirish
    await launchWithRetry(bot);

    // Graceful shutdown (xavfsiz to'xtatish va barcha ma'lumotlarni bazaga yozish)
    const shutdown = async (signal) => {
      console.log(`\n🛑 Tizim to'xtatilmoqda (${signal})...`);
      scheduler.stop();
      bot.stop(signal);
      await proverseService.close();
      await db.flush();
      console.log('👋 Tizim to\'liq xavfsiz to\'xtatildi.');
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Botni ishga tushirishda xatolik:', error.message);
  }
}

main();
