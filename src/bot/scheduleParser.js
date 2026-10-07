/**
 * O'zbek tilida kiritilgan kunlar va soatni tahlil qilib, Cron ifodasiga aylantiruvchi modul
 */

export function parseScheduleText(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // 1. Vaqtni topish (masalan: 05:00, 5:00, 18:30, soat 5 da, 17:00 da)
  let hour = 5;
  let minute = 0;

  const timeMatch = clean.match(/(\d{1,2})[:.](\d{2})/) || clean.match(/soat\s*(\d{1,2})/);
  if (timeMatch) {
    if (timeMatch[2]) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
    } else {
      hour = parseInt(timeMatch[1], 10);
      minute = 0;
    }
  }

  // Soat chegaralarini tekshirish
  if (hour < 0 || hour > 23) hour = 5;
  if (minute < 0 || minute > 59) minute = 0;

  // 2. Hafta kunlarini aniqlash
  // 0 = Yakshanba, 1 = Dushanba, 2 = Seshanba, 3 = Chorshanba, 4 = Payshanba, 5 = Juma, 6 = Shanba
  const days = [];

  if (clean.includes('har kun') || clean.includes('hamma kun') || clean.includes('kundalik')) {
    days.push(0, 1, 2, 3, 4, 5, 6);
  } else if (clean.includes('toq') || (clean.includes('dush') && clean.includes('chor') && clean.includes('jum'))) {
    // Toq kunlar: Dushanba (1), Chorshanba (3), Juma (5)
    days.push(1, 3, 5);
  } else if (clean.includes('juft') || (clean.includes('sesh') && clean.includes('pay') && clean.includes('shan'))) {
    // Juft kunlar: Seshanba (2), Payshanba (4), Shanba (6)
    days.push(2, 4, 6);
  } else {
    if (clean.includes('dush') || clean.includes('duy')) days.push(1);
    if (clean.includes('sesh')) days.push(2);
    if (clean.includes('chor')) days.push(3);
    if (clean.includes('pay')) days.push(4);
    if (clean.includes('jum')) days.push(5);
    if (clean.includes('shan')) days.push(6);
    if (clean.includes('yak')) days.push(0);
  }

  // Agar kunlar aniqlanmasa, standart qilib Toq kunlarni olamiz (1, 3, 5)
  const finalDays = days.length > 0 ? [...new Set(days)].sort() : [1, 3, 5];

  const daysCron = finalDays.join(',');
  const cronExpression = `${minute} ${hour} * * ${daysCron}`;

  // Kunlar matni
  const dayNames = {
    1: 'Dushanba',
    2: 'Seshanba',
    3: 'Chorshanba',
    4: 'Payshanba',
    5: 'Juma',
    6: 'Shanba',
    0: 'Yakshanba',
  };

  const readableDays = finalDays.map(d => dayNames[d]).join(', ');
  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    hour,
    minute,
    days: finalDays,
    cronExpression,
    readableDays,
    formattedTime,
    displayText: `${readableDays} kunlari soat ${formattedTime} da`,
  };
}
