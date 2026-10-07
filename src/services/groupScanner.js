import { db } from '../database/db.js';

export class GroupScannerService {
  /**
   * Telegram guruh nomi bilan ProVerse saytidagi guruh nomini solishtirish va eng yaqinini topish
   */
  static matchGroupName(telegramTitle, proverseGroups = []) {
    if (!telegramTitle) return null;

    const clean = (str) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9а-яёўқғҳ\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanTg = clean(telegramTitle);

    // 1. To'liq yoki qisman o'xshashlik
    for (const pGroup of proverseGroups) {
      const pName = typeof pGroup === 'string' ? pGroup : pGroup.name;
      const cleanP = clean(pName);

      if (cleanTg.includes(cleanP) || cleanP.includes(cleanTg)) {
        return pName;
      }
    }

    // 2. Kalit so'zlar bo'yicha qidirish (masalan "c-2", "c-3", "c-1", "backend")
    const tgParts = cleanTg.split(' ').filter(w => w.length >= 2);
    for (const pGroup of proverseGroups) {
      const pName = typeof pGroup === 'string' ? pGroup : pGroup.name;
      const cleanP = clean(pName);
      const pParts = cleanP.split(' ').filter(w => w.length >= 2);

      const commonWords = tgParts.filter(w => pParts.includes(w));
      if (commonWords.length >= 2 || (commonWords.length >= 1 && (commonWords[0].startsWith('c-') || commonWords[0].startsWith('c_')))) {
        return pName;
      }
    }

    return telegramTitle; // Agar topilmasa, o'zining nomini qaytarish
  }

  /**
   * Guruhdagi barcha o'quvchilar va ularning qilinmagan vazifalari (heshteglari) ro'yxatini tahlil qilish
   */
  static auditGroupTasks(chatId) {
    const group = db.getGroup(chatId);
    const students = db.getStudentsByGroup(chatId);
    const assignments = db.getAssignmentsByGroup(chatId);
    const submissions = db.getSubmissions(chatId);

    const result = {
      groupName: group?.name || 'Guruh',
      totalStudents: students.length,
      totalAssignments: assignments.length,
      assignments: assignments.map(a => a.hashtag),
      studentsAudit: [],
    };

    for (const student of students) {
      const studentSubmissions = submissions.filter(s =>
        String(s.studentId) === String(student.id) ||
        (s.studentName && s.studentName.toLowerCase() === student.fullName.toLowerCase())
      );

      const submittedHashtags = new Set(
        studentSubmissions.map(s => db.normalizeHashtag(s.hashtag))
      );

      const missingAssignments = assignments.filter(
        a => !submittedHashtags.has(db.normalizeHashtag(a.hashtag))
      );

      result.studentsAudit.push({
        id: student.id,
        fullName: student.fullName,
        completedCount: studentSubmissions.length,
        missingCount: missingAssignments.length,
        missingHashtags: missingAssignments.map(a => a.hashtag),
      });
    }

    return result;
  }

  /**
   * Guruh audit hisobotini chiroyli matn shaklida chiqarish
   */
  static formatAuditReport(auditResult) {
    const { groupName, totalStudents, totalAssignments, assignments, studentsAudit } = auditResult;

    let msg = `🔍 <b>GURUHNING TO'LIQ TAHLILI VA QILINMAGAN VAZIFALAR</b>\n\n` +
      `🏢 <b>Guruh:</b> ${groupName}\n` +
      `👥 <b>Jami o'quvchilar:</b> ${totalStudents} nafar\n` +
      `📚 <b>Berilgan vazifalar:</b> ${totalAssignments} ta (${assignments.join(', ') || 'Hozircha yo\'q'})\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>📋 O'quvchilar bo'yicha qilinmagan vazifalar:</b>\n\n`;

    if (studentsAudit.length === 0) {
      msg += `<i>Guruhda hali o'quvchilar ro'yxatga olinmagan. O'quvchilar vazifa yuborganida yoki <code>/add_student</code> buyrug'i orqali avtomatik to'ldiriladi.</i>\n`;
    } else {
      studentsAudit.forEach((s, idx) => {
        if (s.missingCount === 0) {
          msg += `${idx + 1}. <b>${s.fullName}</b> — ✅ Barcha vazifalar bajarilgan!\n`;
        } else {
          msg += `${idx + 1}. <b>${s.fullName}</b> — ❌ Qilinmagan (${s.missingCount} ta): <code>${s.missingHashtags.join(', ')}</code>\n`;
        }
      });
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 <i>Bot barcha yangi topshirilgan vazifalarni real vaqtda kuzatib boradi!</i>`;

    return msg;
  }
}
