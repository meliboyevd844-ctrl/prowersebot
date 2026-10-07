/**
 * Telegram guruhlariga jo'natish uchun hisobot va jadval shakllantiruvchi modul
 */

export function generateReportMessage({
  groupName,
  assignmentHashtag,
  assignmentTitle,
  students,
  submissions,
  dateString
}) {
  const date = dateString || new Date().toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const submittedStudentIds = new Set(
    submissions.map(s => String(s.studentId || s.studentName).toLowerCase())
  );

  let plusCount = 0;
  let minusCount = 0;

  // O'quvchilarni alifbo tartibida saralash
  const sortedStudents = [...students].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'uz')
  );

  const rows = sortedStudents.map((std, index) => {
    const isCompleted = submittedStudentIds.has(String(std.id).toLowerCase()) ||
      submissions.some(s => s.studentName && s.studentName.toLowerCase() === std.fullName.toLowerCase());

    if (isCompleted) {
      plusCount++;
      return `${String(index + 1).padStart(2, ' ')}. [+]  ${std.fullName}`;
    } else {
      minusCount++;
      return `${String(index + 1).padStart(2, ' ')}. [-]  ${std.fullName}`;
    }
  });

  const total = sortedStudents.length;
  const percentage = total > 0 ? Math.round((plusCount / total) * 100) : 0;

  const header = `📋 <b>VAZIFA NATIJALARI VA HISOBOT</b>\n` +
    `🏢 <b>Guruh:</b> ${groupName}\n` +
    `📌 <b>Vazifa:</b> <code>${assignmentHashtag || 'Umumiy'}</code> ${assignmentTitle ? `(${assignmentTitle})` : ''}\n` +
    `📅 <b>Sana:</b> ${date}\n` +
    `📊 <b>Statistika:</b> ${plusCount}/${total} ta (${percentage}% bajardi)\n\n` +
    `<code>` +
    `№   Holat  O'quvchi\n` +
    `--------------------------------\n` +
    (rows.length > 0 ? rows.join('\n') : "O'quvchilar ro'yxati mavjud emas.") +
    `\n--------------------------------\n` +
    `[+] Bajardi (${plusCount})  |  [-] Bajarmadi (${minusCount})` +
    `</code>\n\n` +
    `💡 <i>Vazifani o'z vaqtida topshirgan barcha o'quvchilarga rahmat!</i>`;

  return header;
}

/**
 * Oddiy qisqa tasdiq xabari (o'quvchi vazifa tashlaganda)
 */
export function generateSubmissionAckMessage(studentName, hashtag, proverseSuccess = true) {
  if (proverseSuccess) {
    return `✅ <b>Vazifa qabul qilindi!</b>\n\n` +
      `👤 <b>O'quvchi:</b> ${studentName}\n` +
      `📌 <b>Heshteg:</b> <code>${hashtag}</code>\n` +
      `🌐 <b>ProVerse:</b> Tizimda <i>"Bajarildi"</i> deb belgilandi.`;
  } else {
    return `⚠️ <b>Vazifa qabul qilindi!</b>\n\n` +
      `👤 <b>O'quvchi:</b> ${studentName}\n` +
      `📌 <b>Heshteg:</b> <code>${hashtag}</code>\n` +
      `<i>(ProVerse saytiga ulanish keyinroq qayta sinab ko'riladi)</i>`;
  }
}
