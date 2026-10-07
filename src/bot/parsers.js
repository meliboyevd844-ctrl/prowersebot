/**
 * Telegram xabarlaridan heshteglar va o'quvchi ism-familiyasini tahlil qiluvchi yuqori aniqlikdagi parser
 */

const FILLER_WORDS = new Set([
  'salom', 'assalomu', 'alaykum', 'assalom', 'aleykum', 'valaykum', 'ustoz', 'vazifa',
  'uyga', 'dars', 'tekshirib', 'koring', 'ko\'ring', 'kuring', 'korib', 'ko\'rib',
  'berildi', 'kod', 'rahmat', 'raxmat', 'tashakkur', 'qildim', 'bajardim', 'yubordim',
  'tashladim', 'mana', 'shu', 'iltimos', 'tekshiring', 'kodim', 'masala', 'darsdagi',
  'topshiriq', 'javob', 'php', 'oop', 'class', 'html', 'css', 'js', 'backend', 'frontend'
]);

export function parseSubmissionMessage(text, caption = '') {
  const content = (text || caption || '').trim();
  if (!content) return null;

  // 1. Heshteglarni topish (#masala_20_9, #vazifa22, #php, #ip_adress ...)
  const hashtagRegex = /#([a-zA-Z0-9_ğöşçüıĞÖŞÇÜIа-яА-ЯёЁўқғҳЎҚҒҲ\-]+)/g;
  const matches = [...content.matchAll(hashtagRegex)];
  
  if (!matches || matches.length === 0) {
    return null;
  }

  const hashtags = matches.map(m => `#${m[1]}`);
  const primaryHashtag = hashtags[0]; // Asosiy heshteg

  // 2. Ism-familiyani ajratib olish
  // Heshteglarni matndan olib tashlaymiz
  const cleanedText = content.replace(hashtagRegex, ' ').trim();

  // Matnni qatorlarga ajratish
  const lines = cleanedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let detectedName = '';

  // Agar alohida qatorda 2 yoki 3 ta so'zdan iborat ism-familiya bo'lsa
  for (const line of lines) {
    // Qator boshidagi raqamli ro'yxat belgilarini tozalash (masalan "1. ", "1) ", "1- ")
    const cleanLine = line
      .replace(/^\s*\d+[\.\)\-\:\s]+\s*/, '')
      .replace(/[:,;!?@#$%^&*()_+=\\\[\]{}|<>/"~`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleanLine.split(' ').filter(w => w.length >= 2);
    
    if (words.length >= 2 && words.length <= 4) {
      const nonFillerWords = words.filter(w => !FILLER_WORDS.has(w.toLowerCase()));
      
      if (nonFillerWords.length >= 2) {
        detectedName = nonFillerWords
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        break;
      }
    }
  }

  // Agar alohida qatorda topilmasa, tozalangan barcha so'zlardan qidiramiz
  if (!detectedName && cleanedText) {
    const allWords = cleanedText
      .replace(/^\s*\d+[\.\)\-\:\s]+\s*/gm, '')
      .replace(/[:,;!?@#$%^&*()_+=\\\[\]{}|<>/"~`]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);

    const nonFillerWords = allWords.filter(w => !FILLER_WORDS.has(w.toLowerCase()));

    if (nonFillerWords.length >= 2) {
      detectedName = nonFillerWords
        .slice(0, 3)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return {
    rawContent: content,
    hashtags,
    primaryHashtag,
    detectedName: detectedName || null,
  };
}

/**
 * O'qituvchi yangi dars videosi va vazifa qo'yganini aniqlovchi parser
 */
export function parseTeacherLessonPost(text, caption = '') {
  const content = (text || caption || '').trim();
  if (!content) return null;

  const hashtagRegex = /#([a-zA-Z0-9_ğöşçüıĞÖŞÇÜIа-яА-ЯёЁўқғҳЎҚҒҲ\-]+)/g;
  const matches = [...content.matchAll(hashtagRegex)];
  
  if (!matches || matches.length === 0) return null;

  const hashtags = matches.map(m => `#${m[1]}`);

  // Dars mavzusini aniqlash (masalan: "22-dars. OOP CLASS")
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let lessonTitle = lines[0] || 'Yangi vazifa';

  return {
    lessonTitle,
    hashtags,
    primaryHashtag: hashtags[0],
    rawContent: content,
  };
}
