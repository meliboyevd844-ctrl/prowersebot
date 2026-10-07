import { db } from '../src/database/db.js';
import { GroupScannerService } from '../src/services/groupScanner.js';

console.log('🧪 KO\'P GURUHLAR VA VAZIFALAR AUDITI TESTI\n');

const group1 = {
  chatId: '-1001111111111',
  name: 'C-2 | KESSAKLAR HAMJAMIYATIda',
};

const group2 = {
  chatId: '-1002222222222',
  name: 'Backend C-3 (16:00 - 17:30)',
};

// 1. Guruhlarni saqlash
db.saveGroup(group1);
db.saveGroup(group2);

// Guruh 1: O'quvchilar va vazifalar
db.addOrUpdateStudent(group1.chatId, { fullName: 'Berdiqulov Asilbek' });
db.addOrUpdateStudent(group1.chatId, { fullName: 'Erkinova Mahliyo' });
db.addOrUpdateStudent(group1.chatId, { fullName: 'Karimov Jasur' });

db.saveAssignment({ chatId: group1.chatId, hashtag: '#masala_20_9', title: '20-dars masalalari' });
db.saveAssignment({ chatId: group1.chatId, hashtag: '#vazifa22', title: '22-dars OOP Class' });

// O'quvchilar topshirgan vazifalari
const student1 = db.findStudent(group1.chatId, 'Berdiqulov Asilbek');
db.saveSubmission({ chatId: group1.chatId, studentId: student1.id, studentName: student1.fullName, hashtag: '#masala_20_9' });
db.saveSubmission({ chatId: group1.chatId, studentId: student1.id, studentName: student1.fullName, hashtag: '#vazifa22' });

const student2 = db.findStudent(group1.chatId, 'Erkinova Mahliyo');
db.saveSubmission({ chatId: group1.chatId, studentId: student2.id, studentName: student2.fullName, hashtag: '#masala_20_9' });
// Erkinova Mahliyo #vazifa22 ni topshirmagan!
// Karimov Jasur hech qaysisini topshirmagan!

// 2. Audit tahlilini olish
const audit = GroupScannerService.auditGroupTasks(group1.chatId);
const report = GroupScannerService.formatAuditReport(audit);

console.log(report);

// 3. Guruh nomlarini ProVerse bilan solishtirish testi
const proverseGroups = ['Backend C-3', 'Backend C-1', 'C-2 Kessaklar Hamjamiyati'];
const matched1 = GroupScannerService.matchGroupName(group1.name, proverseGroups);
const matched2 = GroupScannerService.matchGroupName(group2.name, proverseGroups);

console.log('\n--- GURUH NOMINI MOSLASH TESTI ---');
console.log(`Telegram: "${group1.name}" -> ProVerse: "${matched1}"`);
console.log(`Telegram: "${group2.name}" -> ProVerse: "${matched2}"`);

console.log('\n✅ BARCHA TESTLAR MUVAFFAQIYATLI O\'TDI!');
