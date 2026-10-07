import { ProverseGuide } from '../services/proverseGuide.js';

/**
 * O'quvchilar va adminlar savollariga insondek (samimiy, bilimdon ustoz ohangida) javob beruvchi Aqlli Yordamchi Moduli
 */
export class AiAssistant {
  /**
   * Savol yoki xabarga samimiy va professional ustoz sifatida javob qaytarish
   */
  static async generateReply(questionText, studentName = "O'quvchi") {
    const clean = (questionText || '').trim();
    if (!clean) return null;

    const lower = clean.toLowerCase();

    // 1. ProVerse sayti va tugmalari haqidagi savollar
    const proverseExplanation = ProverseGuide.explainQuery(clean);
    if (proverseExplanation) {
      return proverseExplanation;
    }

    // 2. Salomlashish va hol-ahvol
    if (lower === 'salom' || lower === 'assalomu alaykum' || lower === 'assalom aleykum' || lower === 'qalaysiz') {
      return `Va alaykum assalom, ${studentName}! 😊 Kayfiyatingiz yaxshimi? Darslar, vazifalar yoki ProVerse tizimi bo'yicha savollaringiz bo'lsa, bemalol so'rang, yordam berishdan mamnunman!`;
    }

    // 3. Rahmat va minnatdorchilik
    if (lower.includes('rahmat') || lower.includes('tashakkur') || lower.includes('raxmat')) {
      return `Arzimaydi, ${studentName}! 👍 Doimo ilmingiz ziyoda bo'lsin. Savollaringiz bo'lsa, har doim yozishingiz mumkin!`;
    }

    // 4. Vazifani qanday topshirish haqida savol
    if (lower.includes('qanday topshir') || lower.includes('vazifani qayerga') || lower.includes('qanaqa tashlay') || lower.includes('vazifa topshirish')) {
      return `📌 <b>Vazifa topshirish juda oson:</b>\n\n` +
        `Guruhning <b>«Vazifalar»</b> mavzusiga (topikiga) kiring va kodingiz skrinshoti yoki faylini quyidagi tartibda yozib yuboring:\n\n` +
        `<code>#heshteg\n${studentName}</code>\n\n` +
        `Masalan:\n` +
        `<code>#masala_20_9\n${studentName}</code>\n\n` +
        `Men uni darhol qabul qilib, ProVerse saytida siz uchun avtomatik ravishda <i>"Bajarildi"</i> deb belgilab qo'yaman! ✅`;
    }

    // 5. OOP / PHP / Dasturlashga oid tushunchalar
    if (lower.includes('class') || lower.includes('klass') || lower.includes('oop') || lower.includes('constructor') || lower.includes('konstruktor')) {
      return `👨‍💻 <b>OOP va Class haqida tushuncha:</b>\n\n` +
        `<b>Class (Sinf)</b> — bu obyekt yaratish uchun qolip (chizma) hisoblanadi. Masalan: <code>Book</code> klassi.\n` +
        `<b>Constructor (Konstruktor)</b> — yangi obyekt yaratilayotganda (<code>new Book(...)</code>) uning xususiyatlarini (masalan: <i>title, author, year</i>) avtomatik o'rnatib beruvchi maxsus metod.\n\n` +
        `💡 <i>Agar kodingizda xatolik chiqayotgan bo'lsa, xato xabarini yuboring, birgalikda tahlil qilamiz!</i>`;
    }

    if (lower.includes('array') || lower.includes('massiv')) {
      return `💡 <b>Massivlar (Array):</b>\n` +
        `Massiv — bir nechta qiymatni bitta o'zgaruvchida saqlash usulidir. Yangi element qo'shish uchun: <code>$books[] = $newBook;</code> yoki <code>array_push($books, $newBook);</code> usulidan foydalaniladi.`;
    }

    // 6. Xatolik (Error / Bug) haqida so'ralsa
    if (lower.includes('xato') || lower.includes('ishlamayapti') || lower.includes('error') || lower.includes('chiqmayapti')) {
      return `🔍 Kodda xatolik chiqishi — har bir dasturchi uchun eng yaxshi o'rganish tajribasidir! 💡\n\n` +
        `Iltimos, terminal yoki brauzerda chiqqan aniq xatolik matnini (Error message) va yozgan kodingizni yuboring, muammoni birgalikda bartaraf etamiz.`;
    }

    // 7. ProVerse nima yoki nima qila olasan degan savollar
    if (lower.includes('proverse nima') || lower.includes('nima qila olasan') || lower.includes('vazifang nima') || lower.includes('bot nima')) {
      return `🤖 <b>Men ProVerse Aqlli Nazoratchi Botiman!</b>\n\n` +
        `Mening asosiy vazifalarim:\n` +
        `1. Guruhdagi <code>#heshteg</code> bilan topshirilgan uy vazifalarini qabul qilish.\n` +
        `2. ProVerse saytiga (proverse.ct.ws) kirib, o'quvchi vazifasini <i>"Bajarildi"</i> deb belgilash.\n` +
        `3. Guruh o'qituvchisi uchun avtomatik ravishda <code>[+]</code> / <code>[-]</code> jadvalini tuzish.\n` +
        `4. O'quvchilar savollariga do'stona va aniq javob berish.`;
    }

    // 8. Umumiy samimiy javob
    return `Salom, ${studentName}! Savolingizni tushundim. 💡\n` +
      `Ushbu savol bo'yicha batafsilroq ma'lumot yoki kodingizni yuborsangiz, sizga aniqroq ko'maklasha olaman. Shuningdek, dars videosi bo'limidagi ko'rsatmalarni ham qayta ko'rib chiqishingizni tavsiya qilaman! 🚀`;
  }
}
