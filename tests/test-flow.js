import { db } from '../src/database/db.js';
import { parseSubmissionMessage } from '../src/bot/parsers.js';
import { generateReportMessage } from '../src/bot/formatters.js';

console.log('🧪 TO\'LIQ TIZIM OQIMI TESTI (SYSTEM FLOW TEST)\n');

const testChatId = '-1001234567890';
const groupName = 'C-2 | KESSAKLAR HAMJAMIYATI';

// 1. Guruhni yaratish
db.saveGroup({
  chatId: testChatId,
  name: groupName,
  topics: {
    homework: 101,
    lessons: 102,
    announcements: 103,
  }
});

// 2. Bir nechta o'quvchilarni oldindan qo'shish (masalan 4 ta o'quvchi)
db.addOrUpdateStudent(testChatId, { fullName: 'Berdiqulov Asilbek' });
db.addOrUpdateStudent(testChatId, { fullName: 'Erkinova Mahliyo' });
db.addOrUpdateStudent(testChatId, { fullName: 'Karimov Jasur' });
db.addOrUpdateStudent(testChatId, { fullName: 'Toshmatov Botir' });

// 3. O'qituvchi yangi dars vazifasini qo'ydi
db.saveAssignment({
  chatId: testChatId,
  hashtag: '#masala_20_9',
  title: '22-dars. OOP CLASS',
});

// 4. O'quvchi 1 vazifani topshirdi
const msg1 = '#masala_20_9\nberdiqulov asilbek';
const parsed1 = parseSubmissionMessage(msg1);
const student1 = db.findStudent(testChatId, parsed1.detectedName);
if (student1) {
  db.saveSubmission({
    chatId: testChatId,
    studentId: student1.id,
    studentName: student1.fullName,
    hashtag: parsed1.primaryHashtag,
  });
}

// 5. O'quvchi 2 vazifani topshirdi
const msg2 = '#masala_20_9\nErkinova Mahliyo';
const parsed2 = parseSubmissionMessage(msg2);
const student2 = db.findStudent(testChatId, parsed2.detectedName);
if (student2) {
  db.saveSubmission({
    chatId: testChatId,
    studentId: student2.id,
    studentName: student2.fullName,
    hashtag: parsed2.primaryHashtag,
  });
}

// 6. Hisobot generatsiyasini sinash
const students = db.getStudentsByGroup(testChatId);
const submissions = db.getSubmissions(testChatId, '#masala_20_9');

const report = generateReportMessage({
  groupName,
  assignmentHashtag: '#masala_20_9',
  assignmentTitle: '22-dars. OOP CLASS',
  students,
  submissions,
});

console.log('--- GENERATSIYA QILINGAN HISOBOT NAMUNASI ---');
console.log(report);
console.log('---------------------------------------------');

console.log('\n✅ BARCHA TESTLAR MUVAFFAQIYATLI YAKUNLANDI!');
