import { parseSubmissionMessage, parseTeacherLessonPost } from '../src/bot/parsers.js';

console.log('🧪 PARSER TESTLARI BOSHLANDI...\n');

// 1. O'quvchi vazifasi 1
const sub1 = parseSubmissionMessage('#masala_20_9\nberdiqulov asilbek');
console.log('Test 1 (Berdiqulov Asilbek):', sub1);
console.assert(sub1.primaryHashtag === '#masala_20_9', 'Test 1 Hashtag xato!');
console.assert(sub1.detectedName.toLowerCase() === 'berdiqulov asilbek', 'Test 1 Ism xato!');

// 2. O'quvchi vazifasi 2
const sub2 = parseSubmissionMessage('#masala_20_9\nErkinova Mahliyo');
console.log('\nTest 2 (Erkinova Mahliyo):', sub2);
console.assert(sub2.primaryHashtag === '#masala_20_9', 'Test 2 Hashtag xato!');
console.assert(sub2.detectedName.toLowerCase() === 'erkinova mahliyo', 'Test 2 Ism xato!');

// 3. O'qituvchi dars xabari
const teacherPost = `22-dars. OOP CLASS

Vazifa:
1 Book klass
#vazifa22 heshtegi ostida guruhning vazifalar bo'limiga yuboring.`;

const lesson = parseTeacherLessonPost(teacherPost);
console.log('\nTest 3 (O\'qituvchi dars xabari):', lesson);
console.assert(lesson.primaryHashtag === '#vazifa22', 'Test 3 Hashtag xato!');
console.assert(lesson.lessonTitle.includes('22-dars'), 'Test 3 Mavzu xato!');

console.log('\n✅ BARCHA PARSER TESTLARI MUVAFFAQIYATLI O\'TDI!');
