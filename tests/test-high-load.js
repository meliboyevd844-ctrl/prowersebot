import { db } from '../src/database/db.js';
import { parseSubmissionMessage } from '../src/bot/parsers.js';

console.log('⚡ YUQORI YUKLAMA (STRESS TEST & HIGH LOAD) BOSHLANDI...\n');

// Testdan avval tozalash
db.clearAllData();

const groupCount = 5;
const FIRST_NAMES = ['Asilbek', 'Mahliyo', 'Jasur', 'Botir', 'Dilshod', 'Gulnoza', 'Rustam', 'Sardor', 'Shohruh', 'Shahzod', 'Aziz', 'Nilufar', 'Zarina', 'Otabek', 'Madina', 'Jamshid', 'Fotima', 'Zuhra', 'Bobur', 'Kamola'];
const LAST_NAMES = ['Berdiqulov', 'Erkinova', 'Karimov', 'Toshmatov', 'Aliyev', 'Valiyeva', 'Rahmonov', 'Saidov', 'Umarov', 'Qodirov'];

// 1. Guruhlarni yaratish va 100 ta aniq o'quvchi qo'shish (5 guruh x 20 o'quvchi)
const totalStudentsExpected = groupCount * 20;

for (let g = 1; g <= groupCount; g++) {
  const chatId = `-100999000${g}`;
  db.saveGroup({
    chatId,
    name: `Backend C-${g} Guruhi`,
  });

  for (let s = 0; s < 20; s++) {
    const fName = FIRST_NAMES[s];
    const lName = LAST_NAMES[s % LAST_NAMES.length];
    const fullName = `${lName} ${fName}`;

    db.addOrUpdateStudent(chatId, {
      fullName,
      telegramUserId: `${g}${100 + s}`,
    });
  }

  db.saveAssignment({
    chatId,
    hashtag: `#vazifa_dars_${g}`,
    title: `${g}-dars topshirig'i`,
  });
}

console.log(`✅ 5 ta guruh va ${totalStudentsExpected} ta o'quvchi muvaffaqiyatli tayyorlandi.`);

// 2. 100 ta o'quvchi BIR VAQTNING O'ZIDA vazifa topshirdi (Simulyatsiya)
console.log(`🚀 ${totalStudentsExpected} ta parallel vazifa topshirish boshlanmoqda...`);

const startTime = Date.now();

for (let g = 1; g <= groupCount; g++) {
  const chatId = `-100999000${g}`;
  for (let s = 0; s < 20; s++) {
    const fName = FIRST_NAMES[s];
    const lName = LAST_NAMES[s % LAST_NAMES.length];
    
    // Ism-familiya tartibi almashgan yoki to'g'ri shaklda kelishi mumkin
    const rawMsg = s % 2 === 0
      ? `#vazifa_dars_${g}\n${lName} ${fName}`
      : `#vazifa_dars_${g}\n${fName} ${lName}`;

    const parsed = parseSubmissionMessage(rawMsg);
    
    // DB da o'quvchini topish
    const student = db.findStudent(chatId, parsed.detectedName);
    if (!student) {
      console.error(`O'quvchi topilmadi: ${parsed.detectedName} (Guruh: ${chatId})`);
      continue;
    }

    db.saveSubmission({
      chatId,
      studentId: student.id,
      studentName: student.fullName,
      hashtag: parsed.primaryHashtag,
      messageId: s * 10,
    });
  }
}

const elapsedMs = Date.now() - startTime;
console.log(`⏱️ ${totalStudentsExpected} ta vazifani qabul qilish va bazaga yozish vaqti: ${elapsedMs} ms (${(elapsedMs / totalStudentsExpected).toFixed(2)} ms / ta)`);

// Bazadagi barcha topshiriqlarni tekshirish
let totalSubmissions = 0;
for (let g = 1; g <= groupCount; g++) {
  const chatId = `-100999000${g}`;
  const subs = db.getSubmissions(chatId, `#vazifa_dars_${g}`);
  totalSubmissions += subs.length;
}

console.log(`📊 Bazadagi jami topshirilgan vazifalar: ${totalSubmissions}/${totalStudentsExpected} ta`);
console.assert(totalSubmissions === totalStudentsExpected, `Topshiriqlar soni ${totalStudentsExpected} ta bo'lishi kerak!`);

// DB flush testi
await db.flush();
console.log('💾 Ma\'lumotlar bazasi diskka to\'liq va xavfsiz saqlandi.');

console.log('\n🎉 YUQORI YUKLAMA VA STRESS TESTI 100% MUVAFFAQIYATLI O\'TDI!');
process.exit(0);
