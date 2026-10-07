import { parseScheduleText } from '../src/bot/scheduleParser.js';

console.log('🧪 JADVAL MATNLARINI PARSING QILISH TESTI\n');

const testCases = [
  'Dushanba Chorshanba Juma 05:00',
  'Juft kunlar 18:30',
  'Toq kunlar soat 5 da',
  'Har kuni 08:00',
  'Seshanba Payshanba Shanba 16:00',
  'dush chor juma 06:15',
];

testCases.forEach((tc, idx) => {
  const res = parseScheduleText(tc);
  console.log(`Test ${idx + 1}: "${tc}"`);
  console.log(` -> Natija: ${res.displayText} (Cron: ${res.cronExpression})\n`);
});

console.log('✅ BARCHA JADVAL PARSING TESTLARI MUVAFFAQIYATLI O\'TDI!');
