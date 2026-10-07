# 🤖 ProVerse Telegram Bot va Avtomatlashtirish Tizimi

Ushbu bot o'qituvchilar ishini osonlashtirish uchun Telegram guruhlaridagi (Forum / Topics) vazifalarni avtomatik qabul qiladi, **ProVerse** CRM saytida o'quvchini topib vazifani belgilaydi va belgilangan kunlarda (Dushanba, Chorshanba, Juma soat 05:00) guruhga `+` / `-` hisobot jadvalini joylaydi.

---

## 🚀 Xususiyatlar va Imkoniyatlar

1. **Telegram Forum / Topics to'liq qo'llab-quvvatlash**:
   - `Dars Videosi` bo'limida o'qituvchi `#heshteg` bilan dars joylaganda avtomatik ro'yxatga oladi.
   - `Vazifalar` bo'limida o'quvchi rasm/kod va `#heshteg` bilan ism-familiyasini yozganda bir zumda qabul qiladi.
   - `E'lonlar` bo'limiga belgilangan vaqtda avtomatik hisobot yuboradi.

2. **ProVerse bilan Ikki Xil Ulanish (Dual-Mode)**:
   - **`api` rejimi**: Agar saytda REST API bo'lsa, to'g'ridan-to'g'ri API kalit orqali tezkor ishlaydi.
   - **`browser` rejimi (Playwright)**: Agar API bo'lmasa, orqa fonda (headless) saytga login va parol orqali kirib, guruhni ochib o'quvchining vazifasini "Bajarildi" qilib belgilaydi.

3. **Avtomatik Hisobot (Cron Scheduler)**:
   - Dushanba, Chorshanba va Juma kunlari ertalab soat `05:00` da barcha guruhlarga kim bajargan (`+`), kim bajarmaganini (`-`) ko'rsatuvchi toza jadval jo'natadi.

---

## ⚙️ Sozlash (Barcha sozlamalar `.env` faylida)

`.env` faylini oching va quyidagi ma'lumotlarni kiriting:

```env
# 1. Telegram Bot Token (@BotFather orqali olinadi)
TELEGRAM_BOT_TOKEN=8488344598:AAHxxxxxxxxxxxxxxxxxxxxxxxxx

# 2. ProVerse saytiga ulanish
PROVERSE_BASE_URL=https://proverse.uz
PROVERSE_AUTH_MODE=browser  # "browser" yoki "api"

# Agar PROVERSE_AUTH_MODE=browser bo'lsa:
PROVERSE_USERNAME=admin@proverse.uz
PROVERSE_PASSWORD=parolingiz
PLAYWRIGHT_HEADLESS=true

# Agar PROVERSE_AUTH_MODE=api bo'lsa:
PROVERSE_API_KEY=your_api_key_here

# 3. Hisobot jadvali (Dush, Chor, Juma soat 05:00)
REPORT_CRON_SCHEDULE="0 5 * * 1,3,5"
TIMEZONE=Asia/Tashkent
```

---

## 🏃 Ishga tushirish

1. Bog'liqliklarni o'rnatish:
   ```bash
   npm install
   ```

2. Botni ishga tushirish:
   ```bash
   npm start
   ```
   *(Rivojlantirish rejimida o'zgarishlarni kuzatish uchun: `npm run dev`)*

3. Testlarni tekshirish:
   ```bash
   npm test
   node tests/test-flow.js
   ```

---

## 📱 Telegram Guruhda Ishlatish Qo'llanmasi

1. Botni Telegram guruhga qo'shing va **Admin** huquqini bering.
2. Guruhdagi mavzularga (Topics) kirib sozlang:
   - "Vazifalar" mavzusida yozing: `/set_vazifalar`
   - "Dars Videosi" mavzusida yozing: `/set_darslar`
   - "E'lonlar" mavzusida yozing: `/set_elonlar`
3. O'quvchilar vazifa yuborish formati:
   ```
   #masala_20_9
   Berdiqulov Asilbek
   ```
4. Istalgan vaqtda darhol hisobot chiqarish:
   ```
   /hisobot
   ```
