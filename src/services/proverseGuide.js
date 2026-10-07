/**
 * ProVerse Ta'lim Tizimi (proverse.ct.ws) Boshqaruv Paneli va Tugmalar Ma'lumotnomasi
 * Saytdagi barcha bo'limlar, formalar va tugmalar bo'yicha to'liq qo'llanma
 */

export class ProverseGuide {
  /**
   * ProVerse saytidagi barcha asosiy bo'limlar va ularning tavsifi
   */
  static getSections() {
    return {
      dashboard: {
        name: "Asosiy panel (Dashboard)",
        url: "/admin",
        description: "Markazning umumiy holati: jami o'quvchilar, faol guruhlar, kutilayotgan vazifalar va muhim ko'rsatkichlar."
      },
      groups: {
        name: "Guruhlar Boshqaruvi",
        url: "/admin/guruhlar",
        description: "Barcha o'quv guruhlari, o'qituvchilar, dars vaqtlari (Toq/Juft), xonalar va sig'im nazorati.",
        buttons: [
          {
            name: "➕ Yangi Guruh Yaratish",
            action: "Yangi o'quv guruhi ochish. Guruh nomi, yo'nalishi (masalan Backend Dasturlash), o'qituvchi, kunlar (Toq/Juft), vaqt (16:00-19:00), xona va sig'im (masalan 30 yoki 50 o'quvchi) belgilanadi."
          },
          {
            name: "✈️ Telegram Vazifalar Bo'limi",
            action: "Ushbu guruhning Telegramdagi rasmiy mavzusi (topigi) ga to'g'ridan-to'g'ri o'tish imkonini beradi."
          },
          {
            name: "📅 Jadval / Darslar",
            action: "Guruhning haftalik dars jadvalini va o'tiladigan darslar ro'yxatini ko'rish hamda tahrirlash."
          },
          {
            name: "👁️ Ko'rish (Batafsil)",
            action: "Guruh ichidagi o'quvchilar ro'yxati, ularning davomati va o'zlashtirishini alohida ko'rish."
          },
          {
            name: "✏️ Tahrirlash",
            action: "Guruh nomini, dars vaqtini, xonasini yoki biriktirilgan o'qituvchini o'zgartirish."
          },
          {
            name: "🗑️ O'chirish",
            action: "Guruhni tizimdan o'chirish yoki arxivlash."
          }
        ]
      },
      assignments: {
        name: "Vazifalar Bo'limi",
        url: "/admin/vazifalar",
        description: "Guruhlar uchun uy vazifalarini yaratish, saralash, tekshirish va bajarilishini kuzatish.",
        buttons: [
          {
            name: "➕ Yangi vazifa",
            action: "Yangi uy vazifasi yaratish. Vazifa nomi, heshtegi (masalan: #masala_20_9 yoki #vazifa22), topshirish muddati va tavsifi kiritiladi."
          },
          {
            name: "☑️ Tekshirish (Ko'k tugma)",
            action: "Vazifani o'quvchilar qanday topshirganini tekshirish sahifasini ochadi. Kim topshirganini tasdiqlash yoki qaytarish mumkin. Bot bu jarayonni o'quvchilar Telegramda #heshteg bilan rasm tashlaganda avtomatik bajaradi!"
          },
          {
            name: "📅 Haftalik vazifalar",
            action: "Hafta bo'yicha rejalashtirilgan barcha vazifalarni umumiy taqvim ko'rinishida ko'rish."
          },
          {
            name: "🔍 Qidirish va Guruh filtri",
            action: "Guruhlar (masalan: Backend C-3, Backend C-1, C-2 Kessaklar Hamjamiyati) bo'yicha vazifalarni ajratib ko'rish."
          },
          {
            name: "✏️ Tahrirlash",
            action: "Vazifa shartlari, heshtegi yoki muddatini o'zgartirish."
          },
          {
            name: "🗑️ O'chirish",
            action: "Noto'g'ri yoki eskirgan vazifani tizimdan o'chirish."
          },
          {
            name: "✈️ Telegramga yuborish",
            action: "Yangi yaratilgan vazifani guruhning Telegram mavzusiga avtomatik xabar sifatida jo'natish."
          }
        ]
      },
      attendance: {
        name: "Yo'qlama & Haftalik Yo'qlama",
        url: "/admin/yoqlama",
        description: "O'quvchilarning darslarga qatnashish davomatini kunlik va haftalik nazorat qilish.",
        buttons: [
          {
            name: "✅ Bor / ❌ Yo'q / ⚠️ Sababli",
            action: "Har bir o'quvchining darsdagi ishtirokini belgilash."
          },
          {
            name: "💾 Saqlash",
            action: "Kiritilgan davomat ma'lumotlarini bazada qayd etish."
          }
        ]
      },
      payments: {
        name: "To'lovlar Bo'limi",
        url: "/admin/tolovlar",
        description: "O'quvchilar oylik to'lovlari hisobi, qarzdorlar ro'yxati va tushumlar hisoboti.",
        buttons: [
          {
            name: "➕ Yangi To'lov Qabul Qilish",
            action: "O'quvchi to'lagan summani, to'lov turini (naqd/karta) va sanasini tizimga kiritish."
          }
        ]
      },
      rating: {
        name: "O'quvchilar Reytingi & Testlar",
        url: "/admin/reyting",
        description: "Topshirilgan vazifalar va test natijalariga ko'ra o'quvchilarning umumiy reyting jadvali.",
        buttons: [
          {
            name: "🏆 Reytingni yangilash",
            action: "Bajarilgan vazifalar va testlar asosida o'quvchilar ballarini qayta hisoblash."
          }
        ]
      }
    };
  }

  /**
   * Sayt haqidagi umumiy ma'lumot matni
   */
  static getOverviewMessage() {
    return `🖥️ <b>PROVERSE SAYTI BOSHQARUV PANEL QO'LLANMASI</b>\n\n` +
      `🌐 <b>Sayt manzili:</b> <code>https://proverse.ct.ws/admin</code>\n` +
      `👤 <b>Admin foydalanuvchi:</b> <code>aslbek</code>\n\n` +
      `Men ProVerse saytining barcha bo'limlari va tugmalarini to'liq bilaman va nazorat qilaman:\n\n` +
      `1️⃣ <b>Guruhlar Boshqaruvi:</b> Guruhlar ochish, dars vaqtlari, xonalar va sig'im nazorati.\n` +
      `2️⃣ <b>Vazifalar Bo'limi:</b> Uy vazifalari yaratish, heshteglar, o'quvchilar topshirganini <i>"Bajarildi"</i> deb belgilash.\n` +
      `3️⃣ <b>Yo'qlama & Davomat:</b> Kunlik va haftalik darsga qatnashish tahlili.\n` +
      `4️⃣ <b>To'lovlar & Qarzdorlik:</b> O'quvchilar to'lovlari nazorati.\n` +
      `5️⃣ <b>O'quvchilar Reytingi:</b> Ballar va faollik bo'yicha saralash.\n\n` +
      `<i>Quyidagi tugmalardan birini tanlab, batafsil ma'lumot olishingiz mumkin:</i>`;
  }

  /**
   * Guruhlar bo'limi tugmalari haqida batafsil ma'lumot
   */
  static getGroupsGuide() {
    const sec = this.getSections().groups;
    let text = `🏢 <b>PROVERSE: GURUHLAR BOSHQARUVI</b>\n\n` +
      `📌 <b>Tavsif:</b> ${sec.description}\n\n` +
      `<b>Asosiy tugmalar va ularning vazifalari:</b>\n\n`;

    sec.buttons.forEach((btn, idx) => {
      text += `${idx + 1}. <b>${btn.name}</b>\n` +
        `   👉 ${btn.action}\n\n`;
    });

    return text;
  }

  /**
   * Vazifalar bo'limi tugmalari haqida batafsil ma'lumot
   */
  static getAssignmentsGuide() {
    const sec = this.getSections().assignments;
    let text = `📝 <b>PROVERSE: VAZIFALAR BO'LIMI</b>\n\n` +
      `📌 <b>Tavsif:</b> ${sec.description}\n\n` +
      `<b>Asosiy tugmalar va ularning vazifalari:</b>\n\n`;

    sec.buttons.forEach((btn, idx) => {
      text += `${idx + 1}. <b>${btn.name}</b>\n` +
        `   👉 ${btn.action}\n\n`;
    });

    text += `💡 <b>Botning roli:</b> O'quvchilar Telegram guruhga <code>#heshteg</code> bilan vazifa tashlaganda, bot saytga kirib avtomatik <b>«☑️ Tekshirish»</b> tugmasi orqali topshiriqni qabul qiladi!`;
    return text;
  }

  /**
   * Tugma yoki bo'lim bo'yicha savolga javob topish
   */
  static explainQuery(query) {
    if (!query) return null;
    const q = query.toLowerCase();

    if (q.includes('tekshirish') || q.includes('tekshrish')) {
      return `🔘 <b>«☑️ Tekshirish» tugmasi haqida:</b>\n\n` +
        `Ushbu ko'k tugma ProVerse saytidagi <b>Vazifalar</b> bo'limida har bir vazifa kartasida joylashgan.\n\n` +
        `<b>U nima qiladi?</b>\n` +
        `Ushbu tugma bosilganda o'sha vazifa bo'yicha guruhdagi barcha o'quvchilar ro'yxati ochiladi. O'qituvchi kim bajarganini belgilashi mumkin.\n\n` +
        `🤖 <b>Bot buni qanday boshqaradi?</b>\n` +
        `Siz saytga qo'lda kirib o'tirmaysiz! O'quvchi Telegram guruhga <code>#heshteg</code> ostida kod tashlaganda, bot saytga kirib avtomatik shu o'quvchini topadi va vazifani qabul qiladi.`;
    }

    if (q.includes('yangi guruh') || q.includes('guruh yaratish')) {
      return `🔘 <b>«➕ Yangi Guruh Yaratish» tugmasi haqida:</b>\n\n` +
        `Saytning <b>Guruhlar</b> sahifasida yuqori o'ng burchakda joylashgan.\n` +
        `Bu tugma yangi o'quv guruhini tizimga kiritish uchun xizmat qiladi (Guruh nomi, o'qituvchi, kunlar: Toq/Juft, soat: 16:00-19:00, xona va o'quvchilar sig'imi).`;
    }

    if (q.includes('yangi vazifa') || q.includes('vazifa qo\'shish') || q.includes('vazifa ochish')) {
      return `🔘 <b>«➕ Yangi vazifa» tugmasi haqida:</b>\n\n` +
        `Saytning <b>Vazifalar</b> sahifasida yuqori o'ng burchakda joylashgan.\n` +
        `Bu tugma orqali guruhga yangi uy vazifasi beriladi. Unda vazifa sarlavhasi, <code>#heshteg</code> (masalan <code>#masala_20_9</code>) va topshirish muddati belgilanadi.`;
    }

    if (q.includes('yo\'qlama') || q.includes('davomat')) {
      return `🔘 <b>«Yo'qlama» bo'limi haqida:</b>\n\n` +
        `Saytning chap menyusidagi <b>Ta'lim Boshqaruvi -> Yo'qlama</b> bo'limida joylashgan.\n` +
        `O'quvchilarning har kungi darsga kelgan-kelmaganligini belgilab borish uchun xizmat qiladi.`;
    }

    return null;
  }
}
