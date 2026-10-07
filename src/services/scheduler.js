import cron from 'node-cron';
import { config } from '../../config.js';
import { db } from '../database/db.js';
import { generateReportMessage } from '../bot/formatters.js';

export class SchedulerService {
  constructor(bot) {
    this.bot = bot;
    this.mainJob = null;
    this.lastSentMap = new Map(); // "chatId:YYYY-MM-DD-HH:mm" -> true
    this.isRunningCheck = false;
  }

  start() {
    const timezone = config.schedule.timezone || 'Asia/Tashkent';
    console.log(`[Scheduler] Dinamik har bir guruh jadvali nazoratchisi ishga tushirildi (${timezone})`);

    // Har daqiqada guruhlar jadvallarini tekshirib boradi (* * * * *)
    this.mainJob = cron.schedule('* * * * *', async () => {
      await this.checkAndTriggerScheduledReports();
    }, {
      scheduled: true,
      timezone: timezone,
    });
  }

  /**
   * Har daqiqada hozirgi vaqtga to'g'ri kelgan guruhlarni aniqlash va hisobot jo'natish
   */
  async checkAndTriggerScheduledReports() {
    if (this.isRunningCheck) return;
    this.isRunningCheck = true;

    try {
      const now = new Date();
      // Toshkent vaqti bo'yicha hisoblash
      const tashkentTimeStr = now.toLocaleString('en-US', { timeZone: config.schedule.timezone || 'Asia/Tashkent' });
      const localDate = new Date(tashkentTimeStr);

      const currentDay = localDate.getDay(); // 0 = Yakshanba, 1 = Dushanba, ..., 6 = Shanba
      const currentHour = localDate.getHours();
      const currentMinute = localDate.getMinutes();

      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const timeKeyPart = `${year}-${month}-${day}-${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      // Xotirani tozalash (oldingi kunlardagi kalitlarni o'chirish)
      if (this.lastSentMap.size > 500) {
        for (const [key] of this.lastSentMap.entries()) {
          if (!key.includes(`${year}-${month}-${day}`)) {
            this.lastSentMap.delete(key);
          }
        }
      }

      const groups = db.getGroups();

      for (const group of groups) {
        const slotKey = `${group.chatId}:${timeKeyPart}`;
        if (this.lastSentMap.has(slotKey)) {
          continue; // Ushbu vaqt slotida allaqachon jo'natilgan
        }

        let shouldSend = false;

        if (!group.schedule || group.schedule.enabled === false) {
          // Standart rejim: Dush(1), Chor(3), Juma(5) soat 05:00
          if (currentHour === 5 && currentMinute === 0 && [1, 3, 5].includes(currentDay)) {
            shouldSend = true;
          }
        } else {
          const { days, hour, minute } = group.schedule;
          if (days && days.includes(currentDay) && hour === currentHour && minute === currentMinute) {
            shouldSend = true;
          }
        }

        if (shouldSend) {
          this.lastSentMap.set(slotKey, true);
          console.log(`[Scheduler] ⏰ Jadval bo'yicha "${group.name}" guruhiga hisobot yuborilmoqda...`);
          
          try {
            await this.sendGroupReport(group.chatId);
          } catch (err) {
            console.error(`[Scheduler Xatolik] "${group.name}" guruhiga hisobot yuborishda xatolik:`, err.message);
          }

          // Telegram API flood limit (429) ga tushmaslik uchun guruhlar orasida 350ms kutish
          await new Promise(r => setTimeout(r, 350));
        }
      }
    } catch (globalErr) {
      console.error('[Scheduler Xatolik]:', globalErr.message);
    } finally {
      this.isRunningCheck = false;
    }
  }

  /**
   * Muayyan bitta guruhga hisobot yuborish
   */
  async sendGroupReport(chatId, explicitThreadId = null) {
    const group = db.getGroup(chatId);
    if (!group) return false;

    const students = db.getStudentsByGroup(chatId);
    const assignments = db.getAssignmentsByGroup(chatId);

    const latestAssignment = assignments.length > 0
      ? assignments[assignments.length - 1]
      : null;

    const hashtag = latestAssignment?.hashtag || '#vazifa';
    const submissions = db.getSubmissions(chatId, hashtag);

    const messageText = generateReportMessage({
      groupName: group.name || 'ProVerse Guruhi',
      assignmentHashtag: hashtag,
      assignmentTitle: latestAssignment?.title || 'Uyga vazifa',
      students: students,
      submissions: submissions,
    });

    const targetThreadId = explicitThreadId || group.topics?.announcements || group.topics?.homework || null;

    const sendOptions = {
      parse_mode: 'HTML',
    };

    if (targetThreadId) {
      sendOptions.message_thread_id = targetThreadId;
    }

    try {
      await this.bot.telegram.sendMessage(chatId, messageText, sendOptions);
      console.log(`[Scheduler] "${group.name}" guruhiga hisobot muvaffaqiyatli yuborildi!`);
      return true;
    } catch (sendErr) {
      console.warn(`[Scheduler] Telegramga xabar yuborishda xatolik: ${sendErr.message}`);
      return false;
    }
  }

  stop() {
    if (this.mainJob) {
      this.mainJob.stop();
    }
  }
}
