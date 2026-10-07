import { Telegraf, Markup } from 'telegraf';
import { config } from '../../config.js';
import { db } from '../database/db.js';
import { parseSubmissionMessage, parseTeacherLessonPost } from './parsers.js';
import { generateSubmissionAckMessage, generateReportMessage } from './formatters.js';
import { parseScheduleText } from './scheduleParser.js';
import { proverseService } from '../services/proverseService.js';
import { ProverseGuide } from '../services/proverseGuide.js';
import { GroupScannerService } from '../services/groupScanner.js';
import { NotificationService } from '../services/notificationService.js';
import { AiAssistant } from './aiAssistant.js';
import { AdminAuth } from './adminAuth.js';

// Adminlar vaqt kiritayotganda qaysi guruh uchun kiritayotganini eslab qolish (adminId -> { chatId, timestamp })
const adminPendingSchedule = new Map();

// Admin buyruqlari ro'yxati (faqat tasdiqlangan admin kirishga ruxsat)
const ADMIN_COMMANDS = [
  'scan_group', 'hisobot', 'oquvchilar', 'schedule',
  'set_vazifalar', 'set_darslar', 'set_elonlar', 'add_student', 'clear_data'
];

/**
 * Shaxsiy chat uchun doimiy pastki boshqaruv menyusi (Reply Keyboard)
 */
function getMainKeyboard(isVerified = false) {
  return Markup.keyboard([
    ['🌐 Ulanishni tekshirish', '📊 Hisobot olish'],
    ['👥 O\'quvchilar ro\'yxati', '🔍 Guruhni tahlil qilish'],
    ['🖥️ ProVerse Boshqaruvi', '⏰ Hisobot jadvallari'],
    [isVerified ? '🚪 Chiqish (/logout)' : '🔐 Kirish (/login)', 'ℹ️ Yordam']
  ]).resize();
}

/**
 * ProVerse Boshqaruv qo'llanmasi uchun interaktiv Inline Keyboard
 */
function getProverseInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏢 Guruhlar bo\'limi', 'pv_guide_groups'),
      Markup.button.callback('📝 Vazifalar bo\'limi', 'pv_guide_assignments')
    ],
    [
      Markup.button.callback('🌐 Ulanishni tekshirish', 'pv_check_site'),
      Markup.button.callback('🔙 Asosiy ma\'lumot', 'pv_guide_overview')
    ]
  ]);
}

export function createBot() {
  const bot = new Telegraf(config.telegram.botToken);
  const notificationService = new NotificationService(bot);
  proverseService.setNotificationService(notificationService);

  // Telegram menyusida ko'rinuvchi rasmiy buyruqlar ro'yxatini ro'yxatdan o'tkazish
  bot.telegram.setMyCommands([
    { command: 'start', description: 'Botni ishga tushirish va asosiy menyu' },
    { command: 'menu', description: 'Boshqaruv menyusini ochish' },
    { command: 'check_site', description: 'ProVerse saytiga ulanishni tekshirish' },
    { command: 'proverse', description: 'ProVerse sayti va tugmalar ma\'lumotnomasi' },
    { command: 'hisobot', description: 'Vazifalar hisoboti (+ / - jadvali)' },
    { command: 'scan_group', description: 'Guruhni tahlil qilish (qilinmagan vazifalar)' },
    { command: 'schedule', description: 'Guruhning hisobot jadvallari' },
    { command: 'oquvchilar', description: 'O\'quvchilar ro\'yxati' },
    { command: 'login', description: 'Admin sifatida tizimga kirish' },
    { command: 'logout', description: 'Tizimdan chiqish' },
  ]).catch(err => {
    console.warn('[Bot] setMyCommands xatolik:', err.message);
  });

  // Global xatoliklarni ushlab olish va adminga bildirish
  bot.catch(async (err, ctx) => {
    console.error(`[Bot Xatolik Middleware] (${ctx.updateType}):`, err);
    await notificationService.notifyError(
      `Telegram Bot Xatolik (${ctx.updateType})`,
      err.message || String(err),
      { groupName: ctx.chat?.title }
    );
  });

  // ================================================================
  // 1. ADMIN KIRISH VA CHIQISH TIZIMI
  // ================================================================

  // --- /login buyrug'i ---
  const handleLogin = async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.reply('🔒 Xavfsizlik yuzasidan login jarayoni faqat shaxsiy chatda amalga oshiriladi.', { parse_mode: 'HTML' }).catch(() => {});
    }
    if (AdminAuth.isVerified(ctx.from.id)) {
      return ctx.reply(
        '✅ <b>Siz allaqachon tizimga kirgansiz!</b>\n\nBarcha buyruqlar va boshqaruv funksiyalari ochiq.',
        { parse_mode: 'HTML', ...getMainKeyboard(true) }
      ).catch(() => {});
    }
    AdminAuth.startLogin(ctx.from.id);
    return ctx.reply(
      `🔐 <b>ProVerse Admin Tizimiga Kirish</b>\n\n` +
      `Iltimos, admin loginini kiriting:`,
      { parse_mode: 'HTML', ...Markup.removeKeyboard() }
    ).catch(() => {});
  };
  bot.command('login', handleLogin);
  bot.hears('🔐 Kirish (/login)', handleLogin);

  // --- /logout buyrug'i ---
  const handleLogout = async (ctx) => {
    AdminAuth.logout(ctx.from.id);
    return ctx.reply(
      '👋 <b>Tizimdan muvaffaqiyatli chiqdingiz.</b>\n\nQayta kirish uchun <b>/login</b> buyrug\'ini yuboring.',
      { parse_mode: 'HTML', ...getMainKeyboard(false) }
    ).catch(() => {});
  };
  bot.command('logout', handleLogout);
  bot.hears('🚪 Chiqish (/logout)', handleLogout);

  // Admin buyruqlarini himoyalash uchun middleware
  bot.use(async (ctx, next) => {
    const msg = ctx.message;
    if (!msg?.text?.startsWith('/')) return next();

    // /start, /menu, /check_site, /proverse, /login, /logout - barchaga ochiq
    const openCommands = ['start', 'menu', 'check_site', 'proverse', 'login', 'logout'];
    const cmdMatch = msg.text.match(/^\/([a-zA-Z_]+)/);
    const cmd = cmdMatch ? cmdMatch[1] : null;

    if (!cmd || openCommands.includes(cmd)) return next();

    // Guruh xabarlari (o'quvchi vazifalari) uchun admin tekshiruvi shart emas
    if (ctx.chat.type !== 'private') return next();

    // Shaxsiy chatda admin buyruqlariga faqat tasdiqlangan admin kira oladi
    if (ADMIN_COMMANDS.includes(cmd) && !AdminAuth.isVerified(ctx.from.id)) {
      return ctx.reply(
        `🔒 <b>Ushbu bo'lim faqat tasdiqlangan adminlar uchun!</b>\n\n` +
        `Iltimos, avval <b>/login</b> buyrug'i orqali tizimga kiring.`,
        { parse_mode: 'HTML', ...getMainKeyboard(false) }
      ).catch(() => {});
    }

    return next();
  });

  // ================================================================
  // 2. SAYTGA ULANISHNI TEKSHIRISH (DIAGNOSTIKA)
  // ================================================================
  const handleCheckSite = async (ctx) => {
    let statusMsg = null;
    try {
      statusMsg = await ctx.reply(
        "🔍 <i>ProVerse saytiga ulanish tekshirilmoqda, iltimos kuting...</i>",
        { parse_mode: 'HTML' }
      );
    } catch (_) {}

    const result = await proverseService.testConnection();
    const queueStatus = proverseService.getQueueStatus();

    if (result.success) {
      const pingText = result.ping ? ` (${result.ping} ms)` : '';
      const okText = `✅ <b>ProVerse saytiga muvaffaqiyatli ulandim!</b>\n\n` +
        `🌐 <b>Sayt manzili:</b> <code>${config.proverse.baseUrl}</code>\n` +
        `👤 <b>Foydalanuvchi:</b> <code>${config.proverse.username}</code>\n` +
        `⚡ <b>Aloqa tezligi:</b> Faol${pingText} 🟢\n` +
        `📬 <b>Vazifalar navbati:</b> ${queueStatus.pendingTasks} ta kutilmoqda\n` +
        `📊 <b>Boshqaruv holati:</b> Barcha bo'limlar to'liq faol!\n\n` +
        `🚀 <b>Tayyorlik:</b> O'quvchilar guruhlarga tashlagan vazifalarni saytda avtomatik ravishda <i>"Bajarildi"</i> deb belgilashga 100% tayyorman!`;

      if (statusMsg) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          undefined,
          okText,
          { parse_mode: 'HTML', ...getProverseInlineKeyboard() }
        ).catch(() => {});
      } else {
        await ctx.reply(okText, { parse_mode: 'HTML', ...getProverseInlineKeyboard() }).catch(() => {});
      }
    } else {
      const failText = `❌ <b>ProVerse saytiga ulanolmadim!</b>\n\n` +
        `⚠️ <b>Xatolik sababi:</b>\n<code>${result.error || "Saytdan javob kelmadi"}</code>\n\n` +
        `🔍 <b>Mumkin bo'lgan yechimlar:</b>\n` +
        `1. <code>.env</code> faylida <code>PROVERSE_USERNAME</code> va <code>PROVERSE_PASSWORD</code> to'g'ri ekanligini tekshiring.\n` +
        `2. Sayt serveri (<code>${config.proverse.baseUrl}</code>) ishlayotganligiga ishonch hosil qiling.\n` +
        `3. Internet yoki domen (proverse.ct.ws) ulanishini tekshiring.`;

      if (statusMsg) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          undefined,
          failText,
          { parse_mode: 'HTML', ...getProverseInlineKeyboard() }
        ).catch(() => {});
      } else {
        await ctx.reply(failText, { parse_mode: 'HTML', ...getProverseInlineKeyboard() }).catch(() => {});
      }
    }
  };

  bot.command('check_site', handleCheckSite);
  bot.hears('🌐 Ulanishni tekshirish', handleCheckSite);

  // ================================================================
  // 3. PROVERSE SAYTINI TO'LIQ BOSHQARISH VA QO'LLANMA
  // ================================================================
  const handleProverseMenu = async (ctx) => {
    const text = ProverseGuide.getOverviewMessage();
    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...getProverseInlineKeyboard()
    }).catch(() => {});
  };

  bot.command('proverse', handleProverseMenu);
  bot.hears('🖥️ ProVerse Boshqaruvi', handleProverseMenu);

  // ProVerse qo'llanmasi bo'yicha Callback handlerlar
  bot.action('pv_guide_groups', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const text = ProverseGuide.getGroupsGuide();
    return ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getProverseInlineKeyboard()
    }).catch(() => {});
  });

  bot.action('pv_guide_assignments', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const text = ProverseGuide.getAssignmentsGuide();
    return ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getProverseInlineKeyboard()
    }).catch(() => {});
  });

  bot.action('pv_guide_overview', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const text = ProverseGuide.getOverviewMessage();
    return ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getProverseInlineKeyboard()
    }).catch(() => {});
  });

  bot.action('pv_check_site', async (ctx) => {
    await ctx.answerCbQuery('Saytga ulanish tekshirilmoqda...').catch(() => {});
    return handleCheckSite(ctx);
  });

  // ================================================================
  // 4. ASOSIY START VA MENU BUYRUQLARI
  // ================================================================
  const handleStart = async (ctx) => {
    const isPrivate = ctx.chat.type === 'private';
    const isVerified = isPrivate ? AdminAuth.isVerified(ctx.from.id) : false;

    if (isPrivate) {
      const welcome = `👋 <b>Assalomu alaykum, hurmatli Ustoz / Administrator!</b>\n\n` +
        `Men <b>ProVerse</b> o'quv markazi uchun maxsus ishlab chiqilgan <b>Aqlli Vazifalar Nazoratchisi</b> botiman! 🎓🤖\n\n` +
        `🚀 <b>Meni o'quv guruhlaringizga ADMIN qilib qo'shing!</b>\n` +
        `Men barcha guruhlaringiz bilan bir vaqtda ishlay olaman (masalan: <i>Backend C-3, Backend C-1, C-2 Kessaklar Hamjamiyati</i> va boshqalar).\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ <b>Mening asosiy vazifalarim:</b>\n` +
        `1️⃣ <b>Vazifalarni avtomatik qabul qilish:</b> O'quvchilar guruhga <code>#heshteg</code> ostida tashlagan kod va vazifalarini bir zumda qabul qilaman.\n` +
        `2️⃣ <b>ProVerse saytiga kiritish:</b> Saytga orqa fonda kirib, tegishli guruh va o'quvchini topib, vazifani <i>"Bajarildi"</i> deb belgilab qo'yaman.\n` +
        `3️⃣ <b>Har bir guruh uchun alohida Jadval:</b> Har bir guruh uchun hisobot joylash kunlari va vaqtlarini sozlashingiz mumkin.\n` +
        `4️⃣ <b>Guruhni to'liq tahlil qilish (Audit):</b> Guruhdagi har bir o'quvchining qaysi vazifalarni topshirmaganini aniqlab beraman.\n` +
        `5️⃣ <b>Ulanish nazorati:</b> Sayt bilan aloqani istalgan vaqtda <b>«🌐 Ulanishni tekshirish»</b> tugmasi orqali bilib olishingiz mumkin!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 <i>Quyidagi qulay menyu orqali kerakli bo'limni tanlang:</i>`;

      return ctx.reply(welcome, {
        parse_mode: 'HTML',
        ...getMainKeyboard(isVerified)
      }).catch(() => {});
    }

    await ctx.reply(
      `👋 <b>ProVerse Vazifalar Nazoratchisi ushbu guruhda faol!</b>\n\n` +
      `• Guruh tahlili: <code>/scan_group</code>\n` +
      `• Joriy hisobot: <code>/hisobot</code>\n` +
      `• Hisobot jadvali: <code>/schedule</code>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  };

  bot.command('start', handleStart);
  bot.command('menu', handleStart);

  // Yordam bo'limi
  const handleHelp = async (ctx) => {
    const helpText = `ℹ️ <b>PROVERSE BOT QO'LLANMASI VA BUYRUQLARI</b>\n\n` +
      `<b>Asosiy buyruqlar:</b>\n` +
      `• <code>/check_site</code> — ProVerse saytiga ulanish holatini tekshirish\n` +
      `• <code>/proverse</code> — ProVerse sayti va tugmalar ma'lumotnomasi\n` +
      `• <code>/hisobot</code> — Joriy vazifa bo'yicha <code>[+]</code> / <code>[-]</code> jadvalini olish\n` +
      `• <code>/scan_group</code> — Guruhdagi topshirilmagan vazifalar auditi\n` +
      `• <code>/oquvchilar</code> — O'quvchilar ro'yxati\n` +
      `• <code>/schedule</code> — Hisobot jadvallarini ko'rish yoki o'zgartirish\n` +
      `• <code>/login</code> — Admin sifatida tizimga kirish\n` +
      `• <code>/logout</code> — Tizimdan chiqish\n\n` +
      `<b>Guruh mavzulari (Topiklar) sozlash:</b>\n` +
      `• <code>/set_vazifalar</code> — Vazifalar mavzusini belgilash\n` +
      `• <code>/set_darslar</code> — Dars videolari mavzusini belgilash\n` +
      `• <code>/set_elonlar</code> — E'lonlar mavzusini belgilash\n\n` +
      `💡 <i>Pastdagi tugmalar orqali istalgan amalni bir bosishda bajaring!</i>`;

    return ctx.reply(helpText, {
      parse_mode: 'HTML',
      ...getMainKeyboard(AdminAuth.isVerified(ctx.from.id))
    }).catch(() => {});
  };
  bot.hears('ℹ️ Yordam', handleHelp);

  // ================================================================
  // 5. GURUHGA QO'SHILGANDA VA JADVALLAR SOZLASH
  // ================================================================
  bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    const chat = ctx.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;

    // ProVerse tizimidagi guruh nomiga moslash
    const proverseMatchedName = proverseService.resolveGroupName(chat.title);

    const group = db.saveGroup({
      chatId: chat.id,
      name: chat.title,
      proverseGroupName: proverseMatchedName,
      topics: {},
      schedule: {
        days: [1, 3, 5],
        hour: 5,
        minute: 0,
        displayText: 'Dushanba, Chorshanba, Juma kunlari soat 05:00 da',
        enabled: true
      }
    });

    console.log(`[Bot] Yangi guruh qo'shildi: «${chat.title}» (${chat.id}), ProVerse mosligi: "${proverseMatchedName}"`);

    // ProVerse saytidan ushbu guruh o'quvchilarini o'rganib chiqish
    let proverseStudentCount = 0;
    try {
      const pRes = await proverseService.fetchStudentsForGroup(chat.title);
      if (pRes.success && pRes.students?.length > 0) {
        db.saveProverseStudents(proverseMatchedName, pRes.students);
        proverseStudentCount = pRes.students.length;
        console.log(`[Bot] ProVerse saytidan «${proverseMatchedName}» guruhi uchun ${proverseStudentCount} ta o'quvchi ro'yxati olindi.`);
      }
    } catch (e) {
      console.warn('[Bot] ProVerse o\'quvchilarini tekshirishda ogohlantirish:', e.message);
    }

    // Guruhga xush kelibsiz xabari yuborish
    await ctx.reply(
      `👋 <b>Assalomu alaykum, hurmatli o'qituvchi va o'quvchilar!</b>\n\n` +
      `Men <b>ProVerse</b> tizimi bilan integratsiya qilingan <b>Aqlli Nazoratchi</b> botiman! 🎓🤖\n\n` +
      `📌 <b>Guruh nomi:</b> «${chat.title}»\n` +
      `🌐 <b>ProVerse tizimiga ulanish:</b> ${proverseMatchedName ? `<i>${proverseMatchedName}</i> bilan bog'landi ✅` : 'Faol'}\n` +
      `${proverseStudentCount > 0 ? `👥 <b>ProVerse bazasidagi o'quvchilar:</b> ${proverseStudentCount} nafar\n` : ''}\n` +
      `💡 <i>Vazifalarni topshirish uchun <code>#heshteg</code> va ism-familiyangiz bilan yuboring! Faqat guruh va ProVerse tizimiga biriktirilgan o'quvchilar vazifalari qabul qilinadi. Begona shaxslar o'qituvchi tasdig'i orqali qabul qilinadi.</i>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

    // O'qituvchiga / Adminga shaxsiy chatida yozish
    const inviterId = ctx.from?.id;
    const targetAdmins = inviterId ? [String(inviterId)] : config.telegram.adminIds;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📅 Dush-Chor-Jum (05:00)', `sch_${chat.id}_toq_0500`)],
      [Markup.button.callback('📅 Sesh-Pay-Shan (05:00)', `sch_${chat.id}_juft_0500`)],
      [Markup.button.callback('⏰ Dush-Chor-Jum (18:00)', `sch_${chat.id}_toq_1800`)],
      [Markup.button.callback('☀️ Har kuni (08:00)', `sch_${chat.id}_daily_0800`)],
      [Markup.button.callback('✍️ O\'zim boshqa vaqt yozaman', `sch_${chat.id}_custom`)]
    ]);

    const pmText = `👋 <b>Assalomu alaykum, Admin!</b>\n\n` +
      `Men <b>«${chat.title}»</b> guruhiga qo'shildim va guruhni to'liq o'rganib chiqdim! 🎉\n` +
      `🌐 <b>ProVerse tizimidagi mosligi:</b> <i>${proverseMatchedName}</i>\n` +
      `${proverseStudentCount > 0 ? `👥 <b>ProVerse tizimidan ${proverseStudentCount} ta o'quvchi ro'yxati olindi.</b>\n` : ''}\n` +
      `🛡️ <b>Begona o'quvchilar nazorati:</b> Faol! Guruhda ProVerse ro'yxatida bo'lmagan shaxs yozsa yoki vazifa topshirsa, darhol sizga xabar berib ruxsat so'rayman.\n\n` +
      `❓ <b>Ushbu guruh uchun hisobot jadvalini (+ / -) qaysi kunlari va soat nechada joylay?</b>\n\n` +
      `<i>Quyidagi tugmalardan birini tanlang yoki o'zingiz yozing:</i>`;

    for (const adminId of targetAdmins) {
      try {
        await bot.telegram.sendMessage(adminId, pmText, {
          parse_mode: 'HTML',
          ...keyboard
        });
        adminPendingSchedule.set(String(adminId), { chatId: chat.id, timestamp: Date.now() });
      } catch (err) {
        console.warn(`[Bot] Adminga (${adminId}) shaxsiy xabar yuborib bo'lmadi:`, err.message);
      }
    }
  });

  // Jadval sozlash Callback Query handler
  bot.action(/^sch_(-?\d+)_(.+)$/, async (ctx) => {
    const chatId = ctx.match[1];
    const type = ctx.match[2];
    const group = db.getGroup(chatId);

    if (!group) {
      return ctx.answerCbQuery('Guruh topilmadi').catch(() => {});
    }

    if (type === 'custom') {
      adminPendingSchedule.set(String(ctx.from.id), { chatId, timestamp: Date.now() });
      await ctx.reply(
        `✍️ <b>«${group.name}»</b> guruhi uchun hisobot kunlari va soatini yozing:\n\n` +
        `Masalan: <code>Dushanba Chorshanba Juma 05:00</code> yoki <code>Juft kunlar 18:30</code> yoki <code>Har kuni 09:00</code>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
      return ctx.answerCbQuery().catch(() => {});
    }

    let scheduleObj = null;
    if (type === 'toq_0500') {
      scheduleObj = parseScheduleText('Dushanba Chorshanba Juma 05:00');
    } else if (type === 'juft_0500') {
      scheduleObj = parseScheduleText('Seshanba Payshanba Shanba 05:00');
    } else if (type === 'toq_1800') {
      scheduleObj = parseScheduleText('Dushanba Chorshanba Juma 18:00');
    } else if (type === 'daily_0800') {
      scheduleObj = parseScheduleText('Har kuni 08:00');
    }

    if (scheduleObj) {
      group.schedule = {
        days: scheduleObj.days,
        hour: scheduleObj.hour,
        minute: scheduleObj.minute,
        cron: scheduleObj.cronExpression,
        displayText: scheduleObj.displayText,
        enabled: true,
      };
      db.saveGroup(group);

      await ctx.editMessageText(
        `✅ <b>«${group.name}»</b> guruhi uchun hisobot jadvali saqlandi!\n\n` +
        `⏰ <b>Jadval:</b> ${scheduleObj.displayText}\n` +
        `Bot ushbu vaqtda avtomatik ravishda guruhga <code>[+]</code> / <code>[-]</code> jadvalini joylaydi.`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    return ctx.answerCbQuery('Jadval saqlandi!').catch(() => {});
  });

  // ================================================================
  // BEGONA O'QUVCHILARNI TASDIQLASH VA RAD ETISH HANDLERLARI
  // ================================================================

  // --- Admin o'quvchini tasdiqlaganda (✅ Ha, guruhga qo'shilsin) ---
  bot.action(/^appr_yes_(.+)$/, async (ctx) => {
    const approvalId = ctx.match[1];
    const item = db.getPendingApproval(approvalId);

    if (!item) {
      return ctx.answerCbQuery('Ushbu so\'rov allaqachon hal qilingan yoki muddati o\'tgan.').catch(() => {});
    }

    // 1. O'quvchini bazaga qo'shish
    const student = db.addOrUpdateStudent(item.chatId, {
      fullName: item.senderName,
      telegramUserId: item.telegramUserId,
      telegramUsername: item.username,
    });

    // 2. ProVerse ro'yxatiga ham qo'shish
    const currentProverseList = db.getProverseStudents(item.groupName);
    if (!currentProverseList.includes(db.normalize(item.senderName))) {
      db.saveProverseStudents(item.groupName, [...currentProverseList, item.senderName]);
    }

    // 3. Agar vazifa topshirgan bo'lsa, o'sha vazifasini qabul qilish va ProVerse saytiga yuborish
    if (item.hashtag) {
      const submission = db.saveSubmission({
        chatId: item.chatId,
        studentId: student.id,
        studentName: student.fullName,
        hashtag: item.hashtag,
        messageId: item.messageId,
        threadId: item.threadId,
      });

      proverseService.markCompleted({
        groupName: item.groupName,
        studentName: student.fullName,
        hashtag: item.hashtag,
      }).then(res => {
        if (res.success) {
          submission.proverseSynced = true;
          db.saveSubmission(submission);
        }
      }).catch(err => console.error('[Bot ProVerse xatolik]:', err.message));

      // Guruhga xabar berish
      const ackMsg = generateSubmissionAckMessage(student.fullName, item.hashtag, true);
      bot.telegram.sendMessage(item.chatId, ackMsg, {
        parse_mode: 'HTML',
        reply_to_message_id: item.messageId,
        message_thread_id: item.threadId
      }).catch(() => {});
    } else {
      bot.telegram.sendMessage(
        item.chatId,
        `✅ <b>${item.senderName}</b> o'qituvchi tomonidan guruh o'quvchilari ro'yxatiga tasdiqlandi!`,
        { parse_mode: 'HTML', message_thread_id: item.threadId }
      ).catch(() => {});
    }

    db.removePendingApproval(approvalId);
    await ctx.answerCbQuery('O\'quvchi muvaffaqiyatli qo\'shildi!').catch(() => {});

    await ctx.editMessageText(
      `✅ <b>O'quvchi muvaffaqiyatli tasdiqlandi va qo'shildi!</b>\n\n` +
      `👤 <b>O'quvchi:</b> <b>${item.senderName}</b> ${item.username ? `(@${item.username})` : ''}\n` +
      `🏢 <b>Guruh:</b> «${item.groupName}»\n` +
      `🆔 <b>Telegram ID:</b> <code>${item.telegramUserId}</code>\n` +
      `${item.hashtag ? `📌 <b>Topshirgan vazifasi:</b> <code>${item.hashtag}</code> qabul qilindi va ProVerse saytida belgilandi!\n` : ''}\n` +
      `🎉 <i>Ushbu o'quvchi endi guruhning rasmiy o'quvchisi hisoblanadi.</i>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

  // --- Admin o'quvchini rad etganda (❌ Yo'q, rad etilsin) ---
  bot.action(/^appr_no_(.+)$/, async (ctx) => {
    const approvalId = ctx.match[1];
    const item = db.getPendingApproval(approvalId);

    if (!item) {
      return ctx.answerCbQuery('Ushbu so\'rov allaqachon hal qilingan.').catch(() => {});
    }

    db.rejectUser(item.chatId, item.telegramUserId, item.senderName);
    db.removePendingApproval(approvalId);

    if (item.hashtag) {
      bot.telegram.sendMessage(
        item.chatId,
        `❌ <b>Hurmatli ${item.senderName}!</b> Sizning ushbu guruhga o'quvchi sifatida qo'shilishingiz o'qituvchi tomonidan rad etildi.`,
        { parse_mode: 'HTML', reply_to_message_id: item.messageId, message_thread_id: item.threadId }
      ).catch(() => {});
    }

    await ctx.answerCbQuery('O\'quvchi rad etildi.').catch(() => {});

    await ctx.editMessageText(
      `❌ <b>Begona o'quvchi rad etildi.</b>\n\n` +
      `👤 <b>Foydalanuvchi:</b> <b>${item.senderName}</b> ${item.username ? `(@${item.username})` : ''}\n` +
      `🏢 <b>Guruh:</b> «${item.groupName}»\n` +
      `Ushbu shaxs guruh o'quvchilari ro'yxatiga qo'shilmadi va uning vazifalari qabul qilinmaydi.`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

  // --- /schedule buyrug'i va Menyu tugmasi ---
  const handleScheduleList = async (ctx) => {
    const isPrivate = ctx.chat.type === 'private';
    let chatId = ctx.chat.id;

    if (isPrivate) {
      const groups = db.getGroups();
      if (groups.length === 0) {
        return ctx.reply("Hozircha tizimga ulangan guruhlar mavjud emas. Botni biror guruhga qo'shing.").catch(() => {});
      }
      let msg = "📋 <b>GURUHLAR VA ULARNING HISOBOT JADVALLARI:</b>\n\n";
      groups.forEach((g, idx) => {
        msg += `${idx + 1}. <b>${g.name}</b>\n` +
          `   ⏰ Jadval: <code>${g.schedule?.displayText || 'Dushanba, Chorshanba, Juma 05:00'}</code>\n\n`;
      });
      return ctx.reply(msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    const group = db.getGroup(chatId);
    const scheduleText = group?.schedule?.displayText || 'Dushanba, Chorshanba, Juma kunlari soat 05:00 da';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📅 Dush-Chor-Jum (05:00)', `sch_${chatId}_toq_0500`)],
      [Markup.button.callback('📅 Sesh-Pay-Shan (05:00)', `sch_${chatId}_juft_0500`)],
      [Markup.button.callback('✍️ O\'zgartirish (O\'zim yozaman)', `sch_${chatId}_custom`)]
    ]);

    await ctx.reply(
      `⏰ <b>Ushbu guruh hisobot jadvali:</b>\n\n` +
      `👉 <b>${scheduleText}</b>\n\n` +
      `Jadvalni o'zgartirish uchun quyidagi tugmalardan birini tanlang:`,
      { parse_mode: 'HTML', ...keyboard }
    ).catch(() => {});
  };

  bot.command('schedule', handleScheduleList);
  bot.hears('⏰ Hisobot jadvallari', handleScheduleList);

  // ================================================================
  // 6. GURUHNI TAHLIL QILISH (AUDIT)
  // ================================================================
  const handleScanGroup = async (ctx) => {
    const isPrivate = ctx.chat.type === 'private';
    if (isPrivate) {
      const groups = db.getGroups();
      if (groups.length === 0) {
        return ctx.reply("Hozircha guruhlar mavjud emas.").catch(() => {});
      }
      let fullReport = "";
      for (const g of groups) {
        const audit = GroupScannerService.auditGroupTasks(g.chatId);
        fullReport += GroupScannerService.formatAuditReport(audit) + "\n\n━━━━━━━━━━━━━━━━━━━━\n\n";
      }
      return ctx.reply(fullReport || "Guruhlar tahlil qilinmoqda...", { parse_mode: 'HTML' }).catch(() => {});
    }

    const chatId = ctx.chat.id;
    const threadId = ctx.message?.message_thread_id || null;
    const auditResult = GroupScannerService.auditGroupTasks(chatId);
    const reportMsg = GroupScannerService.formatAuditReport(auditResult);

    await ctx.reply(reportMsg, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    }).catch(() => {});
  };

  bot.command('scan_group', handleScanGroup);
  bot.hears('🔍 Guruhni tahlil qilish', handleScanGroup);

  // ================================================================
  // 7. TOPIKLAR VA O'QUVCHILAR BOSHQARUVI
  // ================================================================
  bot.command('set_vazifalar', async (ctx) => {
    const threadId = ctx.message.message_thread_id || null;
    const group = db.getGroup(ctx.chat.id) || { chatId: ctx.chat.id, name: ctx.chat.title || 'Guruh' };
    group.topics = group.topics || {};
    group.topics.homework = threadId;
    db.saveGroup(group);

    await ctx.reply(`✅ Ushbu bo'lim <b>"Vazifalar"</b> mavzusi sifatida muvaffaqiyatli saqlandi!`, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    }).catch(() => {});
  });

  bot.command('set_darslar', async (ctx) => {
    const threadId = ctx.message.message_thread_id || null;
    const group = db.getGroup(ctx.chat.id) || { chatId: ctx.chat.id, name: ctx.chat.title || 'Guruh' };
    group.topics = group.topics || {};
    group.topics.lessons = threadId;
    db.saveGroup(group);

    await ctx.reply(`✅ Ushbu bo'lim <b>"Dars Videosi"</b> mavzusi sifatida muvaffaqiyatli saqlandi!`, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    }).catch(() => {});
  });

  bot.command('set_elonlar', async (ctx) => {
    const threadId = ctx.message.message_thread_id || null;
    const group = db.getGroup(ctx.chat.id) || { chatId: ctx.chat.id, name: ctx.chat.title || 'Guruh' };
    group.topics = group.topics || {};
    group.topics.announcements = threadId;
    db.saveGroup(group);

    await ctx.reply(`✅ Ushbu bo'lim <b>"E'lonlar"</b> mavzusi sifatida saqlandi! Hisobotlar shu mavzuga joylanadi.`, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    }).catch(() => {});
  });

  bot.command('add_student', async (ctx) => {
    const text = ctx.message.text.replace('/add_student', '').trim();
    if (!text) {
      return ctx.reply("❌ Iltimos, o'quvchining to'liq ism-familiyasini kiriting.\nMisol: <code>/add_student Berdiqulov Asilbek</code>", { parse_mode: 'HTML' }).catch(() => {});
    }

    const student = db.addOrUpdateStudent(ctx.chat.id, { fullName: text });
    await ctx.reply(`✅ O'quvchi muvaffaqiyatli qo'shildi: <b>${student.fullName}</b>`, { parse_mode: 'HTML' }).catch(() => {});
  });

  bot.command('clear_data', async (ctx) => {
    if (ctx.chat.type === 'private' && !AdminAuth.isVerified(ctx.from.id)) {
      return ctx.reply("🔒 Faqat tasdiqlangan adminlar uchun.").catch(() => {});
    }
    db.clearAllData();
    return ctx.reply("🧹 <b>Barcha guruhlar, o'quvchilar va vazifalar tozalab tashlandi!</b>\n\nBaza 100% toza holatda.", {
      parse_mode: 'HTML',
      ...getMainKeyboard(true)
    }).catch(() => {});
  });

  const handleStudents = async (ctx) => {
    const isPrivate = ctx.chat.type === 'private';
    if (isPrivate) {
      const groups = db.getGroups();
      if (groups.length === 0) {
        return ctx.reply("Hozircha guruhlar mavjud emas.").catch(() => {});
      }
      let text = "👥 <b>GURUHLAR BO'YICHA O'QUVCHILAR RO'YXATI:</b>\n\n";
      for (const g of groups) {
        const students = db.getStudentsByGroup(g.chatId);
        text += `🏢 <b>${g.name}</b> (${students.length} ta o'quvchi):\n`;
        if (students.length === 0) {
          text += `   <i>O'quvchilar hali vazifa topshirmagan.</i>\n\n`;
        } else {
          students.forEach((s, i) => {
            text += `   ${i + 1}. ${s.fullName}\n`;
          });
          text += `\n`;
        }
      }
      return ctx.reply(text, { parse_mode: 'HTML' }).catch(() => {});
    }

    const students = db.getStudentsByGroup(ctx.chat.id);
    if (students.length === 0) {
      return ctx.reply("ℹ️ Ushbu guruhda hozircha o'quvchilar ro'yxati shakllanmagan. O'quvchilar vazifa topshirganda avtomatik qo'shiladi yoki <code>/add_student Ism Familiya</code> orqali qo'shishingiz mumkin.", { parse_mode: 'HTML' }).catch(() => {});
    }

    const list = students.map((s, i) => `${i + 1}. ${s.fullName}`).join('\n');
    await ctx.reply(`👥 <b>Guruh o'quvchilari (${students.length} nafar):</b>\n\n${list}`, { parse_mode: 'HTML' }).catch(() => {});
  };

  bot.command('oquvchilar', handleStudents);
  bot.hears('👥 O\'quvchilar ro\'yxati', handleStudents);

  // ================================================================
  // 8. HISOBOT OLISH (/hisobot)
  // ================================================================
  const handleReport = async (ctx) => {
    const isPrivate = ctx.chat.type === 'private';

    if (isPrivate) {
      const groups = db.getGroups();
      if (groups.length === 0) {
        return ctx.reply("Hozircha hech qanday guruh qo'shilmagan.").catch(() => {});
      }
      for (const group of groups) {
        const students = db.getStudentsByGroup(group.chatId);
        const assignments = db.getAssignmentsByGroup(group.chatId);
        const latestAssignment = assignments.length > 0 ? assignments[assignments.length - 1] : null;
        const hashtag = latestAssignment?.hashtag || '#vazifa';
        const submissions = db.getSubmissions(group.chatId, hashtag);

        const report = generateReportMessage({
          groupName: group.name,
          assignmentHashtag: hashtag,
          assignmentTitle: latestAssignment?.title || 'Joriy vazifa',
          students,
          submissions,
        });

        await ctx.reply(report, { parse_mode: 'HTML' }).catch(() => {});
      }
      return;
    }

    const chatId = ctx.chat.id;
    const threadId = ctx.message?.message_thread_id || null;

    const group = db.getGroup(chatId) || { name: ctx.chat.title || 'Guruh' };
    const students = db.getStudentsByGroup(chatId);
    const assignments = db.getAssignmentsByGroup(chatId);

    const latestAssignment = assignments.length > 0 ? assignments[assignments.length - 1] : null;
    const hashtag = latestAssignment?.hashtag || '#vazifa';
    const submissions = db.getSubmissions(chatId, hashtag);

    const report = generateReportMessage({
      groupName: group.name,
      assignmentHashtag: hashtag,
      assignmentTitle: latestAssignment?.title || 'Joriy vazifa',
      students,
      submissions,
    });

    await ctx.reply(report, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    }).catch(() => {});
  };

  bot.command('hisobot', handleReport);
  bot.hears('📊 Hisobot olish', handleReport);

  // ================================================================
  // 9. ASOSIY XABARLAR TINGLOVCHISI (LISTENER)
  // ================================================================
  bot.on(['message'], async (ctx, next) => {
    const msg = ctx.message;
    if (!msg) return next();

    const isPrivate = ctx.chat.type === 'private';
    const text = msg.text || '';

    // A. Admin Login jarayoni (login/parol kiritish)
    if (isPrivate && text && !text.startsWith('/') && AdminAuth.isInLoginFlow(ctx.from.id)) {
      const result = AdminAuth.processLoginStep(ctx.from.id, text);
      if (result.handled) {
        const isVerified = AdminAuth.isVerified(ctx.from.id);
        return ctx.reply(result.message, {
          parse_mode: 'HTML',
          ...getMainKeyboard(isVerified)
        }).catch(() => {});
      }
    }

    const caption = msg.caption || '';
    const content = text || caption;

    // B. Admin shaxsiy chatda guruh uchun jadval vaqtini yozgan bo'lsa
    if (isPrivate && adminPendingSchedule.has(String(ctx.from.id)) && text && !text.startsWith('/')) {
      const pendingInfo = adminPendingSchedule.get(String(ctx.from.id));
      if (pendingInfo && (Date.now() - pendingInfo.timestamp < 15 * 60 * 1000)) {
        const targetChatId = pendingInfo.chatId;
        const group = db.getGroup(targetChatId);

        const parsedSchedule = parseScheduleText(text);
        if (parsedSchedule && group) {
          group.schedule = {
            days: parsedSchedule.days,
            hour: parsedSchedule.hour,
            minute: parsedSchedule.minute,
            cron: parsedSchedule.cronExpression,
            displayText: parsedSchedule.displayText,
            enabled: true,
          };
          db.saveGroup(group);
          adminPendingSchedule.delete(String(ctx.from.id));

          return ctx.reply(
            `✅ <b>«${group.name}»</b> guruhi uchun yangi hisobot jadvali saqlandi!\n\n` +
            `⏰ <b>Jadval:</b> ${parsedSchedule.displayText}\n` +
            `Bot ushbu kun va vaqtda avtomatik hisobotni guruhga joylab boradi.`,
            { parse_mode: 'HTML', ...getMainKeyboard(AdminAuth.isVerified(ctx.from.id)) }
          ).catch(() => {});
        }
      } else {
        adminPendingSchedule.delete(String(ctx.from.id));
      }
    }

    if (!content) return next();

    const chatId = ctx.chat.id;
    const chatTitle = ctx.chat.title || 'ProVerse Guruhi';
    const threadId = msg.message_thread_id || null;

    let group = db.getGroup(chatId);
    if (!group && !isPrivate) {
      group = db.saveGroup({
        chatId,
        name: chatTitle,
        proverseGroupName: proverseService.resolveGroupName(chatTitle),
        topics: {}
      });
    }

    // C. O'qituvchi yangi dars/vazifa e'lon qilgan bo'lsa
    if (content.includes('heshtegi ostida') || (content.toLowerCase().includes('dars') && content.includes('#'))) {
      const lesson = parseTeacherLessonPost(text, caption);
      if (lesson && lesson.primaryHashtag) {
        db.saveAssignment({
          chatId,
          hashtag: lesson.primaryHashtag,
          title: lesson.lessonTitle,
        });
        console.log(`[Bot] Yangi vazifa ro'yxatga olindi: "${lesson.primaryHashtag}" (${lesson.lessonTitle})`);
      }
    }

    // D. Guruhdagi o'quvchi xabarlari va vazifalarini nazorat qilish
    if (!isPrivate) {
      if (msg.from?.is_bot) return next();

      const senderId = msg.from?.id;
      const isBotAdmin = config.telegram.adminIds.includes(String(senderId));

      const parsed = parseSubmissionMessage(text, caption);
      let detectedName = parsed?.detectedName;
      if (!detectedName && msg.from) {
        detectedName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
      }
      if (!detectedName) {
        detectedName = msg.from?.username || "Noma'lum foydalanuvchi";
      }

      // Agar ushbu foydalanuvchi avval admin tomonidan rad etilgan bo'lsa
      if (db.isUserRejected(chatId, senderId)) {
        if (parsed?.primaryHashtag) {
          await ctx.reply(`❌ Hurmatli foydalanuvchi, siz o'qituvchi tomonidan ushbu guruhga kiritilmadingiz. Vazifangiz qabul qilinmaydi.`, {
            reply_to_message_id: msg.message_id,
            message_thread_id: threadId
          }).catch(() => {});
        }
        return next();
      }

      // Agar yuboruvchi admin bo'lmasa, begona o'quvchi tekshiruvi:
      if (!isBotAdmin) {
        // 1. Guruhda avval ro'yxatga olinganmi?
        let student = db.findStudent(chatId, detectedName) ||
          db.getStudentsByGroup(chatId).find(s => String(s.telegramUserId) === String(senderId));

        if (!student) {
          // 2. ProVerse saytidagi rasmiy o'quvchilar ro'yxati bilan solishtirish
          const pGroupName = group?.proverseGroupName || group?.name;
          const inProverse = db.isStudentInProverse(pGroupName, detectedName);

          if (inProverse) {
            // ProVerse da bor! Rasmiy o'quvchi, avtomatik guruhga qo'shamiz
            student = db.addOrUpdateStudent(chatId, {
              fullName: detectedName,
              telegramUserId: senderId,
              telegramUsername: msg.from?.username,
            });
            console.log(`[Bot] O'quvchi ProVerse bazasi bilan mos keldi va guruhga qo'shildi: "${detectedName}"`);
          } else {
            // 3. ProVerse da ham, bazada ham YO'Q! Begona o'quvchi tasdig'i
            const pending = db.getPendingApprovalByUserId(chatId, senderId);
            if (!pending) {
              const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              db.addPendingApproval({
                id: approvalId,
                chatId,
                groupName: group?.name || chatTitle,
                senderName: detectedName,
                telegramUserId: senderId,
                username: msg.from?.username,
                sampleText: (text || caption).substring(0, 100) || '(Rasm yoki fayl)',
                hashtag: parsed?.primaryHashtag || null,
                messageId: msg.message_id,
                threadId: threadId,
              });

              // Adminga shaxsiy xabarnoma yuborish
              const adminNotifyText = `⚠️ <b>GURUHDA BEGONA / NOMA'LUM O'QUVCHI ANIQLANDI!</b>\n\n` +
                `🏢 <b>Guruh:</b> «${group?.name || chatTitle}»\n` +
                `👤 <b>Foydalanuvchi:</b> <b>${detectedName}</b> ${msg.from?.username ? `(@${msg.from.username})` : ''}\n` +
                `🆔 <b>Telegram ID:</b> <code>${senderId}</code>\n` +
                `${parsed?.primaryHashtag ? `📌 <b>Topshirayotgan vazifasi:</b> <code>${parsed.primaryHashtag}</code>\n` : ''}` +
                `💬 <b>Xabari:</b> <i>"${(text || caption).substring(0, 100) || 'Vazifa yoki fayl'}"</i>\n\n` +
                `❓ <b>Ushbu begona o'quvchini «${group?.name || chatTitle}» guruhiga qo'shaymi?</b>`;

              const adminApprovalButtons = Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ Ha, guruhga qo\'shilsin', `appr_yes_${approvalId}`),
                  Markup.button.callback('❌ Yo\'q, begona (rad etilsin)', `appr_no_${approvalId}`)
                ]
              ]);

              for (const adminId of config.telegram.adminIds) {
                bot.telegram.sendMessage(adminId, adminNotifyText, {
                  parse_mode: 'HTML',
                  ...adminApprovalButtons
                }).catch(err => console.warn(`[Bot] Adminga (${adminId}) so'rov yuborib bo'lmadi:`, err.message));
              }
            }

            // Agar o'quvchi vazifa tashlagan bo'lsa, ogohlantirish beramiz
            if (parsed?.primaryHashtag) {
              await ctx.reply(
                `⏳ <b>Hurmatli ${detectedName}!</b>\n\n` +
                `Siz ushbu guruhning ProVerse tizimidagi rasmiy o'quvchilari ro'yxatida mavjud emassiz. Vazifangiz o'qituvchi tasdiqlashi kutilmoqda. 📋`,
                {
                  parse_mode: 'HTML',
                  reply_to_message_id: msg.message_id,
                  message_thread_id: threadId
                }
              ).catch(() => {});
              return next();
            }
          }
        }
      }

      // Agar o'quvchi tasdiqlangan bo'lsa va vazifa (#heshteg) topshirgan bo'lsa
      if (parsed && parsed.primaryHashtag) {
        let student = db.findStudent(chatId, detectedName) ||
          db.getStudentsByGroup(chatId).find(s => String(s.telegramUserId) === String(senderId));

        if (!student) {
          student = db.addOrUpdateStudent(chatId, {
            fullName: detectedName,
            telegramUserId: senderId,
            telegramUsername: msg.from?.username,
          });
        }

        console.log(`[Bot] Vazifa qabul qilindi: ${parsed.primaryHashtag}, O'quvchi: "${student.fullName}"`);

        const submission = db.saveSubmission({
          chatId,
          studentId: student.id,
          studentName: student.fullName,
          hashtag: parsed.primaryHashtag,
          messageId: msg.message_id,
          threadId: threadId,
        });

        // ProVerse saytida navbat (Queue) orqali belgilash
        proverseService.markCompleted({
          groupName: group?.name || chatTitle,
          studentName: student.fullName,
          hashtag: parsed.primaryHashtag,
        }).then(res => {
          if (res.success) {
            submission.proverseSynced = true;
            db.saveSubmission(submission);
          }
        }).catch(err => {
          console.error('[Bot ProVerse xatolik]:', err.message);
        });

        const ackMsg = generateSubmissionAckMessage(student.fullName, parsed.primaryHashtag, true);
        await ctx.reply(ackMsg, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: threadId
        }).catch(() => {});
        return next();
      }
    }

    // E. Savollarga AI Mentor (Ustoz) yoki ProVerse qo'llanmasi sifatida javob berish
    const isReplyToBot = msg.reply_to_message?.from?.id === ctx.botInfo?.id;
    const isMentioned = text.includes(`@${ctx.botInfo?.username}`) || text.includes('proversebot') || text.includes('ustoz') || text.includes('bot');

    if (isPrivate || isReplyToBot || isMentioned) {
      let studentName = msg.from ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') : "O'quvchi";
      const cleanQuestion = text.replace(`@${ctx.botInfo?.username}`, '').trim();

      const aiReply = await AiAssistant.generateReply(cleanQuestion, studentName);
      if (aiReply) {
        await ctx.reply(aiReply, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: threadId
        }).catch(() => {});
      }
    }

    return next();
  });

  return bot;
}
