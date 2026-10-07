import fs from 'fs';
import path from 'path';
import { config } from '../../config.js';

function isSubsetName(shorterTokens, longerTokens) {
  if (shorterTokens.length < 2) return false;
  const longerCopy = [...longerTokens];
  for (const token of shorterTokens) {
    const idx = longerCopy.indexOf(token);
    if (idx === -1) return false;
    longerCopy.splice(idx, 1);
  }
  return true;
}

class JsonDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      groups: [],
      students: [],
      assignments: [],
      submissions: [],
      settings: {}
    };
    this.isWriting = false;
    this.pendingWrite = false;
    this.writeDebounceTimer = null;
    this.init();
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        this.data.groups = this.data.groups || [];
        this.data.students = this.data.students || [];
        this.data.assignments = this.data.assignments || [];
        this.data.submissions = this.data.submissions || [];
        this.data.settings = this.data.settings || {};
      } catch (err) {
        console.error("[Database] Ma'lumotlar bazasini yuklashda xatolik:", err.message);
      }
    } else {
      this.saveSync();
    }
  }

  /**
   * Keshdagi ma'lumotlarni xavfsiz va navbatli (debounced) diskka yozish
   */
  save() {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    this.writeDebounceTimer = setTimeout(() => {
      this._executeWrite();
    }, 150);
  }

  /**
   * Zudlik bilan diskka yozish (Synchronous / Shutdown uchun)
   */
  saveSync() {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
      this.writeDebounceTimer = null;
    }
    try {
      const tempPath = `${this.filePath}.${Date.now()}_${Math.random().toString(36).substr(2, 4)}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      
      let retries = 5;
      while (retries > 0) {
        try {
          fs.renameSync(tempPath, this.filePath);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
            try { fs.unlinkSync(tempPath); } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error("[Database] Bazaga to'g'ridan-to'g'ri yozishda xatolik:", err.message);
    }
  }

  /**
   * Asinxron va bloklamaydigan xavfsiz yozish
   */
  async _executeWrite() {
    if (this.isWriting) {
      this.pendingWrite = true;
      return;
    }

    this.isWriting = true;
    this.pendingWrite = false;

    try {
      const tempPath = `${this.filePath}.${Date.now()}_${Math.random().toString(36).substr(2, 4)}.tmp`;
      const jsonStr = JSON.stringify(this.data, null, 2);
      
      await fs.promises.writeFile(tempPath, jsonStr, 'utf-8');

      let retries = 5;
      while (retries > 0) {
        try {
          await fs.promises.rename(tempPath, this.filePath);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            await fs.promises.writeFile(this.filePath, jsonStr, 'utf-8');
            try { await fs.promises.unlink(tempPath); } catch (_) {}
          } else {
            await new Promise(res => setTimeout(res, 50));
          }
        }
      }
    } catch (err) {
      console.error("[Database] Asinxron yozishda xatolik:", err.message);
    } finally {
      this.isWriting = false;
      if (this.pendingWrite) {
        this.pendingWrite = false;
        setImmediate(() => this._executeWrite());
      }
    }
  }

  /**
   * Barcha kutilayotgan yozishlarni to'liq yakunlash
   */
  async flush() {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
      this.writeDebounceTimer = null;
    }
    this.saveSync();
  }

  // --- Guruhlar Boshqaruvi ---
  getGroups() {
    return this.data.groups || [];
  }

  getGroup(chatId) {
    if (!this.data.groups) return null;
    return this.data.groups.find(g => String(g.chatId) === String(chatId));
  }

  saveGroup(groupData) {
    this.data.groups = this.data.groups || [];
    const idx = this.data.groups.findIndex(g => String(g.chatId) === String(groupData.chatId));
    if (idx >= 0) {
      this.data.groups[idx] = { ...this.data.groups[idx], ...groupData, updatedAt: new Date().toISOString() };
    } else {
      this.data.groups.push({
        id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        ...groupData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    this.save();
    return this.getGroup(groupData.chatId);
  }

  // --- O'quvchilar Boshqaruvi ---
  getStudentsByGroup(chatId) {
    if (!this.data.students) return [];
    return this.data.students.filter(s => String(s.chatId) === String(chatId));
  }

  findStudent(chatId, queryName) {
    if (!queryName) return null;
    const cleanQuery = this.normalize(queryName);
    if (!cleanQuery) return null;

    const students = this.getStudentsByGroup(chatId);
    if (students.length === 0) return null;
    
    // 1. To'liq aniq moslik (Exact match)
    let found = students.find(s => this.normalize(s.fullName) === cleanQuery);
    if (found) return found;

    // 2. So'zlar tartibi almashgan bo'lsa ("Asilbek Berdiqulov" == "Berdiqulov Asilbek")
    const queryTokens = cleanQuery.split(' ').filter(Boolean);
    const querySorted = [...queryTokens].sort().join(' ');

    found = students.find(s => {
      const parts = this.normalize(s.fullName).split(' ').filter(Boolean);
      return parts.length > 0 && [...parts].sort().join(' ') === querySorted;
    });
    if (found) return found;

    // 3. Agar so'rov 2 yoki undan ortiq so'zdan iborat bo'lsa va biri ikkinchisining to'liq qismi bo'lsa
    if (queryTokens.length >= 2) {
      found = students.find(s => {
        const studentTokens = this.normalize(s.fullName).split(' ').filter(Boolean);
        if (queryTokens.length < studentTokens.length) {
          return isSubsetName(queryTokens, studentTokens);
        } else if (queryTokens.length > studentTokens.length) {
          return isSubsetName(studentTokens, queryTokens);
        }
        return false;
      });
      if (found) return found;
    }

    // 4. Agar so'rov 1 ta so'z bo'lsa (faqatgina ism yoki familiya to'liq teng bo'lsa va uzunligi >= 3)
    if (queryTokens.length === 1 && queryTokens[0].length >= 3) {
      const singleWord = queryTokens[0];
      found = students.find(s => {
        const studentTokens = this.normalize(s.fullName).split(' ').filter(Boolean);
        return studentTokens.includes(singleWord);
      });
      if (found) return found;
    }

    return null;
  }

  addOrUpdateStudent(chatId, studentData) {
    this.data.students = this.data.students || [];
    const norm = this.normalize(studentData.fullName);
    const existing = this.findStudent(chatId, norm);

    if (existing) {
      Object.assign(existing, studentData, { updatedAt: new Date().toISOString() });
      this.save();
      return existing;
    } else {
      const newStudent = {
        id: `std_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        chatId: String(chatId),
        fullName: studentData.fullName.trim(),
        telegramUserId: studentData.telegramUserId || null,
        telegramUsername: studentData.telegramUsername || null,
        createdAt: new Date().toISOString()
      };
      this.data.students.push(newStudent);
      this.save();
      return newStudent;
    }
  }

  // --- Vazifalar (Assignments & Hashtags) ---
  saveAssignment(assignment) {
    this.data.assignments = this.data.assignments || [];
    const normalizedTag = this.normalizeHashtag(assignment.hashtag);
    const idx = this.data.assignments.findIndex(
      a => String(a.chatId) === String(assignment.chatId) && this.normalizeHashtag(a.hashtag) === normalizedTag
    );

    const data = {
      id: `ass_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ...assignment,
      normalizedHashtag: normalizedTag,
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) {
      this.data.assignments[idx] = { ...this.data.assignments[idx], ...data };
    } else {
      data.createdAt = new Date().toISOString();
      this.data.assignments.push(data);
    }
    this.save();
    return data;
  }

  getAssignmentsByGroup(chatId) {
    if (!this.data.assignments) return [];
    return this.data.assignments.filter(a => String(a.chatId) === String(chatId));
  }

  findAssignment(chatId, hashtag) {
    if (!this.data.assignments) return null;
    const normTag = this.normalizeHashtag(hashtag);
    return this.data.assignments.find(
      a => String(a.chatId) === String(chatId) && this.normalizeHashtag(a.hashtag) === normTag
    );
  }

  // --- Topshirilgan Vazifalar (Submissions) ---
  saveSubmission(submission) {
    this.data.submissions = this.data.submissions || [];
    const normTag = this.normalizeHashtag(submission.hashtag);
    const existingIdx = this.data.submissions.findIndex(
      s => String(s.chatId) === String(submission.chatId) &&
           String(s.studentId) === String(submission.studentId) &&
           this.normalizeHashtag(s.hashtag) === normTag
    );

    const record = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...submission,
      normalizedHashtag: normTag,
      submittedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.data.submissions[existingIdx] = { ...this.data.submissions[existingIdx], ...record };
    } else {
      this.data.submissions.push(record);
    }
    this.save();
    return record;
  }

  getSubmissions(chatId, hashtag = null) {
    if (!this.data.submissions) return [];
    return this.data.submissions.filter(s => {
      const matchGroup = String(s.chatId) === String(chatId);
      if (!hashtag) return matchGroup;
      return matchGroup && this.normalizeHashtag(s.hashtag) === this.normalizeHashtag(hashtag);
    });
  }

  // --- ProVerse Saytidagi Rasmiy O'quvchilar ---
  saveProverseStudents(groupName, studentsList) {
    this.data.settings = this.data.settings || {};
    this.data.settings.proverseStudents = this.data.settings.proverseStudents || {};
    this.data.settings.proverseStudents[this.normalize(groupName)] = studentsList.map(s => this.normalize(s));
    this.save();
  }

  getProverseStudents(groupName) {
    this.data.settings = this.data.settings || {};
    this.data.settings.proverseStudents = this.data.settings.proverseStudents || {};
    return this.data.settings.proverseStudents[this.normalize(groupName)] || [];
  }

  isStudentInProverse(groupName, queryName) {
    const list = this.getProverseStudents(groupName);
    if (!list || list.length === 0) return false;
    const cleanQuery = this.normalize(queryName);
    if (!cleanQuery) return false;

    // 1. To'liq moslik
    if (list.includes(cleanQuery)) return true;

    // 2. So'zlar tartibi almashgan bo'lsa ("Asilbek Berdiqulov" == "Berdiqulov Asilbek")
    const queryParts = cleanQuery.split(' ').filter(Boolean);
    const querySorted = [...queryParts].sort().join(' ');

    const matched = list.some(s => {
      const parts = s.split(' ').filter(Boolean);
      if (parts.length > 0 && [...parts].sort().join(' ') === querySorted) return true;
      if (queryParts.length < parts.length && isSubsetName(queryParts, parts)) return true;
      if (queryParts.length > parts.length && isSubsetName(parts, queryParts)) return true;
      return false;
    });

    return matched;
  }

  // --- Kutilayotgan Tasdiqlar (Pending Approvals) ---
  addPendingApproval(item) {
    this.data.settings = this.data.settings || {};
    this.data.settings.pendingApprovals = this.data.settings.pendingApprovals || [];

    const idx = this.data.settings.pendingApprovals.findIndex(
      p => p.id === item.id || (p.chatId === item.chatId && p.telegramUserId === item.telegramUserId)
    );
    if (idx >= 0) {
      this.data.settings.pendingApprovals[idx] = { ...this.data.settings.pendingApprovals[idx], ...item, updatedAt: new Date().toISOString() };
    } else {
      this.data.settings.pendingApprovals.push({
        ...item,
        createdAt: new Date().toISOString()
      });
    }
    this.save();
  }

  getPendingApproval(id) {
    const list = this.data.settings?.pendingApprovals || [];
    return list.find(p => p.id === id);
  }

  getPendingApprovalByUserId(chatId, telegramUserId) {
    const list = this.data.settings?.pendingApprovals || [];
    return list.find(p => String(p.chatId) === String(chatId) && String(p.telegramUserId) === String(telegramUserId));
  }

  removePendingApproval(id) {
    if (!this.data.settings?.pendingApprovals) return;
    this.data.settings.pendingApprovals = this.data.settings.pendingApprovals.filter(p => p.id !== id);
    this.save();
  }

  // --- Rad Etilgan Foydalanuvchilar (Rejected Users) ---
  rejectUser(chatId, telegramUserId, name) {
    this.data.settings = this.data.settings || {};
    this.data.settings.rejectedUsers = this.data.settings.rejectedUsers || [];

    const exists = this.data.settings.rejectedUsers.some(r => String(r.chatId) === String(chatId) && String(r.telegramUserId) === String(telegramUserId));
    if (!exists) {
      this.data.settings.rejectedUsers.push({
        chatId: String(chatId),
        telegramUserId: String(telegramUserId),
        name,
        rejectedAt: new Date().toISOString()
      });
      this.save();
    }
  }

  isUserRejected(chatId, telegramUserId) {
    const list = this.data.settings?.rejectedUsers || [];
    return list.some(r => String(r.chatId) === String(chatId) && String(r.telegramUserId) === String(telegramUserId));
  }

  // Barcha guruh va ma'lumotlarni tozalash
  clearAllData() {
    this.data.groups = [];
    this.data.students = [];
    this.data.assignments = [];
    this.data.submissions = [];
    this.saveSync();
  }

  // Yordamchi tozalovchi funksiyalar
  normalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/['`’ʼʻ]/g, "'")
      .replace(/[^a-z0-9а-яёўқғҳ'\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeHashtag(tag) {
    if (!tag) return '';
    return tag
      .toLowerCase()
      .replace(/#/g, '')
      .replace(/['`’ʼʻ]/g, '')
      .replace(/[^a-z0-9а-яёўқғҳ_]/gi, '')
      .replace(/\s+/g, '_')
      .trim();
  }
}

export const db = new JsonDatabase(config.database.path);
