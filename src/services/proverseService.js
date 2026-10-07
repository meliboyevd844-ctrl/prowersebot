import { config } from '../../config.js';
import { ProverseApiService } from './proverseApi.js';
import { ProverseBrowserService } from './proverseBrowser.js';
import { GroupScannerService } from './groupScanner.js';

class ProverseServiceManager {
  constructor() {
    this.apiService = new ProverseApiService();
    this.browserService = new ProverseBrowserService();
    this.notificationService = null;
    this.knownGroups = [];
    
    // Asinxron vazifalar navbati (Task Queue)
    this.taskQueue = [];
    this.isProcessingQueue = false;
    this.stats = {
      totalQueued: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };
  }

  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Saytga ulanishni tekshirish va diagnostika qilish
   */
  async testConnection() {
    return await this.browserService.testConnection();
  }

  /**
   * Telegram guruh nomini ProVerse guruh nomi bilan solishtirish
   */
  resolveGroupName(telegramTitle) {
    return GroupScannerService.matchGroupName(telegramTitle, this.knownGroups);
  }

  /**
   * Ushbu guruh o'quvchilarini ProVerse saytidan olish
   */
  async fetchStudentsForGroup(groupName) {
    const matchedGroupName = this.resolveGroupName(groupName);
    return await this.browserService.fetchStudentsFromProverse(matchedGroupName);
  }

  /**
   * Vazifani navbatga (Queue) qo'yish va asinxron qayta ishlash
   * Bu tizim orqali 100 lab o'quvchilar bir vaqtda vazifa tashlasa ham bot qotib qolmaydi!
   */
  async markCompleted({ groupName, studentName, hashtag }) {
    const matchedGroupName = this.resolveGroupName(groupName);

    // Navbatda aynan shu vazifa kutilayotgan bo'lsa, qayta qo'shmaslik (Deduplication)
    const isAlreadyQueued = this.taskQueue.some(
      job => job.groupName === matchedGroupName &&
             job.studentName.toLowerCase() === studentName.toLowerCase() &&
             job.hashtag.toLowerCase() === hashtag.toLowerCase()
    );

    if (isAlreadyQueued) {
      console.log(`[Queue] Vazifa allaqachon navbatda turibdi: "${studentName}" (${hashtag})`);
      return { success: true, queued: true, message: 'Allaqachon navbatda' };
    }

    return new Promise((resolve) => {
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        groupName: matchedGroupName,
        studentName,
        hashtag,
        retries: 0,
        maxRetries: 2,
        resolve,
        createdAt: Date.now(),
      };

      this.taskQueue.push(task);
      this.stats.totalQueued++;
      console.log(`[Queue] Yangi vazifa navbatga qo'shildi. Navbatdagi jami: ${this.taskQueue.length} ta.`);

      // Navbatni yurgizish
      setImmediate(() => this.processQueue());
    });
  }

  /**
   * Navbatdagi ishlarni ketma-ket xavfsiz bajarish
   */
  async processQueue() {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();

        console.log(`[Queue Worker] Vazifa bajarilmoqda (${this.taskQueue.length} ta qoldi): ${task.studentName} -> ${task.hashtag}`);

        let result = { success: false, error: 'Noma\'lum xatolik' };

        try {
          // 1. Browser yoki API orqali bajarish
          if (config.proverse.authMode === 'api' && config.proverse.apiKey) {
            result = await this.apiService.markAssignmentCompleted({
              groupName: task.groupName,
              studentName: task.studentName,
              hashtag: task.hashtag,
            });
          } else {
            result = await this.browserService.markAssignmentCompleted({
              groupName: task.groupName,
              studentName: task.studentName,
              hashtag: task.hashtag,
            });
          }
        } catch (execErr) {
          result = { success: false, error: execErr.message };
        }

        if (result.success) {
          this.stats.totalSuccess++;
          task.resolve(result);
        } else {
          // Qayta urinish (Retry logic)
          if (task.retries < task.maxRetries) {
            task.retries++;
            console.warn(`[Queue Worker] ⚠️ Vazifa xato berdi, qayta urinish (${task.retries}/${task.maxRetries})...`);
            await new Promise(r => setTimeout(r, 2000));
            this.taskQueue.unshift(task); // Qaytadan navbat boshiga qo'yish
          } else {
            this.stats.totalFailed++;
            console.error(`[Queue Worker] ❌ Vazifani belgilab bo'lmadi: ${result.error}`);
            
            if (this.notificationService) {
              await this.notificationService.notifyError(
                "ProVerse saytida vazifani belgilash",
                result.error || "Sayt javob bermayapti yoki qotib qoldi",
                { groupName: task.groupName, studentName: task.studentName, hashtag: task.hashtag }
              );
            }
            task.resolve(result);
          }
        }

        // Keyingi vazifa oldidan kichik nafas (100ms) berish
        await new Promise(r => setTimeout(r, 100));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  getQueueStatus() {
    return {
      pendingTasks: this.taskQueue.length,
      isProcessing: this.isProcessingQueue,
      stats: this.stats,
    };
  }

  async close() {
    this.taskQueue = [];
    await this.browserService.close();
  }
}

export const proverseService = new ProverseServiceManager();
