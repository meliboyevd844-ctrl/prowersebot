import axios from 'axios';
import { config } from '../../config.js';

export class ProverseApiService {
  constructor() {
    this.baseUrl = config.proverse.baseUrl;
    this.apiKey = config.proverse.apiKey;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Vazifani o'quvchi uchun bajarildi qilib belgilash
   */
  async markAssignmentCompleted({ groupName, studentName, hashtag }) {
    try {
      console.log(`[API] Vazifani belgilash: Guruh: "${groupName}", O'quvchi: "${studentName}", Heshteg: "${hashtag}"`);
      
      const response = await this.client.post('/api/assignments/complete', {
        group_name: groupName,
        student_name: studentName,
        hashtag: hashtag,
        completed_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(`[API Xatolik] Vazifani belgilashda xatolik:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Guruhlar ro'yxatini olish
   */
  async fetchGroups() {
    try {
      const response = await this.client.get('/api/groups');
      return response.data;
    } catch (error) {
      console.error(`[API Xatolik] Guruhlarni olishda xatolik:`, error.message);
      return [];
    }
  }

  /**
   * Guruh o'quvchilari ro'yxatini olish
   */
  async fetchStudents(groupId) {
    try {
      const response = await this.client.get(`/api/groups/${groupId}/students`);
      return response.data;
    } catch (error) {
      console.error(`[API Xatolik] O'quvchilarni olishda xatolik:`, error.message);
      return [];
    }
  }
}
