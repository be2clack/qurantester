/**
 * Surah information with page ranges in Medina Mushaf
 */
export interface SurahInfo {
  number: number
  nameArabic: string
  nameEnglish: string
  nameRussian: string
  meaningEnglish: string
  meaningRussian: string
  versesCount: number
  startPage: number
  endPage: number
  revelationType: 'meccan' | 'medinan'
}

/**
 * All 114 Surahs with their information
 * Page numbers are based on standard Medina Mushaf
 */
export const SURAHS: SurahInfo[] = [
  { number: 1, nameArabic: 'الفاتحة', nameEnglish: 'Al-Fatihah', nameRussian: 'Аль-Фатиха', meaningEnglish: 'The Opening', meaningRussian: 'Открывающая', versesCount: 7, startPage: 1, endPage: 1, revelationType: 'meccan' },
  { number: 2, nameArabic: 'البقرة', nameEnglish: 'Al-Baqarah', nameRussian: 'Аль-Бакара', meaningEnglish: 'The Cow', meaningRussian: 'Корова', versesCount: 286, startPage: 2, endPage: 49, revelationType: 'medinan' },
  { number: 3, nameArabic: 'آل عمران', nameEnglish: 'Ali \'Imran', nameRussian: 'Али Имран', meaningEnglish: 'Family of Imran', meaningRussian: 'Семейство Имрана', versesCount: 200, startPage: 50, endPage: 76, revelationType: 'medinan' },
  { number: 4, nameArabic: 'النساء', nameEnglish: 'An-Nisa', nameRussian: 'Ан-Ниса', meaningEnglish: 'The Women', meaningRussian: 'Женщины', versesCount: 176, startPage: 77, endPage: 106, revelationType: 'medinan' },
  { number: 5, nameArabic: 'المائدة', nameEnglish: 'Al-Ma\'idah', nameRussian: 'Аль-Маида', meaningEnglish: 'The Table Spread', meaningRussian: 'Трапеза', versesCount: 120, startPage: 106, endPage: 127, revelationType: 'medinan' },
  { number: 6, nameArabic: 'الأنعام', nameEnglish: 'Al-An\'am', nameRussian: 'Аль-Анам', meaningEnglish: 'The Cattle', meaningRussian: 'Скот', versesCount: 165, startPage: 128, endPage: 150, revelationType: 'meccan' },
  { number: 7, nameArabic: 'الأعراف', nameEnglish: 'Al-A\'raf', nameRussian: 'Аль-Араф', meaningEnglish: 'The Heights', meaningRussian: 'Преграды', versesCount: 206, startPage: 151, endPage: 176, revelationType: 'meccan' },
  { number: 8, nameArabic: 'الأنفال', nameEnglish: 'Al-Anfal', nameRussian: 'Аль-Анфаль', meaningEnglish: 'The Spoils of War', meaningRussian: 'Добыча', versesCount: 75, startPage: 177, endPage: 186, revelationType: 'medinan' },
  { number: 9, nameArabic: 'التوبة', nameEnglish: 'At-Tawbah', nameRussian: 'Ат-Тауба', meaningEnglish: 'The Repentance', meaningRussian: 'Покаяние', versesCount: 129, startPage: 187, endPage: 207, revelationType: 'medinan' },
  { number: 10, nameArabic: 'يونس', nameEnglish: 'Yunus', nameRussian: 'Юнус', meaningEnglish: 'Jonah', meaningRussian: 'Иона', versesCount: 109, startPage: 208, endPage: 221, revelationType: 'meccan' },
  { number: 11, nameArabic: 'هود', nameEnglish: 'Hud', nameRussian: 'Худ', meaningEnglish: 'Hud', meaningRussian: 'Худ', versesCount: 123, startPage: 221, endPage: 235, revelationType: 'meccan' },
  { number: 12, nameArabic: 'يوسف', nameEnglish: 'Yusuf', nameRussian: 'Юсуф', meaningEnglish: 'Joseph', meaningRussian: 'Иосиф', versesCount: 111, startPage: 235, endPage: 248, revelationType: 'meccan' },
  { number: 13, nameArabic: 'الرعد', nameEnglish: 'Ar-Ra\'d', nameRussian: 'Ар-Раад', meaningEnglish: 'The Thunder', meaningRussian: 'Гром', versesCount: 43, startPage: 249, endPage: 255, revelationType: 'medinan' },
  { number: 14, nameArabic: 'إبراهيم', nameEnglish: 'Ibrahim', nameRussian: 'Ибрахим', meaningEnglish: 'Abraham', meaningRussian: 'Авраам', versesCount: 52, startPage: 255, endPage: 261, revelationType: 'meccan' },
  { number: 15, nameArabic: 'الحجر', nameEnglish: 'Al-Hijr', nameRussian: 'Аль-Хиджр', meaningEnglish: 'The Rocky Tract', meaningRussian: 'Хиджр', versesCount: 99, startPage: 262, endPage: 267, revelationType: 'meccan' },
  { number: 16, nameArabic: 'النحل', nameEnglish: 'An-Nahl', nameRussian: 'Ан-Нахль', meaningEnglish: 'The Bee', meaningRussian: 'Пчёлы', versesCount: 128, startPage: 267, endPage: 281, revelationType: 'meccan' },
  { number: 17, nameArabic: 'الإسراء', nameEnglish: 'Al-Isra', nameRussian: 'Аль-Исра', meaningEnglish: 'The Night Journey', meaningRussian: 'Ночной перенос', versesCount: 111, startPage: 282, endPage: 293, revelationType: 'meccan' },
  { number: 18, nameArabic: 'الكهف', nameEnglish: 'Al-Kahf', nameRussian: 'Аль-Кахф', meaningEnglish: 'The Cave', meaningRussian: 'Пещера', versesCount: 110, startPage: 293, endPage: 304, revelationType: 'meccan' },
  { number: 19, nameArabic: 'مريم', nameEnglish: 'Maryam', nameRussian: 'Марьям', meaningEnglish: 'Mary', meaningRussian: 'Мария', versesCount: 98, startPage: 305, endPage: 312, revelationType: 'meccan' },
  { number: 20, nameArabic: 'طه', nameEnglish: 'Taha', nameRussian: 'Та Ха', meaningEnglish: 'Ta-Ha', meaningRussian: 'Та Ха', versesCount: 135, startPage: 312, endPage: 321, revelationType: 'meccan' },
  { number: 21, nameArabic: 'الأنبياء', nameEnglish: 'Al-Anbiya', nameRussian: 'Аль-Анбия', meaningEnglish: 'The Prophets', meaningRussian: 'Пророки', versesCount: 112, startPage: 322, endPage: 331, revelationType: 'meccan' },
  { number: 22, nameArabic: 'الحج', nameEnglish: 'Al-Hajj', nameRussian: 'Аль-Хадж', meaningEnglish: 'The Pilgrimage', meaningRussian: 'Паломничество', versesCount: 78, startPage: 332, endPage: 341, revelationType: 'medinan' },
  { number: 23, nameArabic: 'المؤمنون', nameEnglish: 'Al-Mu\'minun', nameRussian: 'Аль-Муминун', meaningEnglish: 'The Believers', meaningRussian: 'Верующие', versesCount: 118, startPage: 342, endPage: 349, revelationType: 'meccan' },
  { number: 24, nameArabic: 'النور', nameEnglish: 'An-Nur', nameRussian: 'Ан-Нур', meaningEnglish: 'The Light', meaningRussian: 'Свет', versesCount: 64, startPage: 350, endPage: 359, revelationType: 'medinan' },
  { number: 25, nameArabic: 'الفرقان', nameEnglish: 'Al-Furqan', nameRussian: 'Аль-Фуркан', meaningEnglish: 'The Criterion', meaningRussian: 'Различение', versesCount: 77, startPage: 359, endPage: 366, revelationType: 'meccan' },
  { number: 26, nameArabic: 'الشعراء', nameEnglish: 'Ash-Shu\'ara', nameRussian: 'Аш-Шуара', meaningEnglish: 'The Poets', meaningRussian: 'Поэты', versesCount: 227, startPage: 367, endPage: 376, revelationType: 'meccan' },
  { number: 27, nameArabic: 'النمل', nameEnglish: 'An-Naml', nameRussian: 'Ан-Намль', meaningEnglish: 'The Ant', meaningRussian: 'Муравьи', versesCount: 93, startPage: 377, endPage: 385, revelationType: 'meccan' },
  { number: 28, nameArabic: 'القصص', nameEnglish: 'Al-Qasas', nameRussian: 'Аль-Касас', meaningEnglish: 'The Stories', meaningRussian: 'Рассказы', versesCount: 88, startPage: 385, endPage: 396, revelationType: 'meccan' },
  { number: 29, nameArabic: 'العنكبوت', nameEnglish: 'Al-\'Ankabut', nameRussian: 'Аль-Анкабут', meaningEnglish: 'The Spider', meaningRussian: 'Паук', versesCount: 69, startPage: 396, endPage: 404, revelationType: 'meccan' },
  { number: 30, nameArabic: 'الروم', nameEnglish: 'Ar-Rum', nameRussian: 'Ар-Рум', meaningEnglish: 'The Romans', meaningRussian: 'Римляне', versesCount: 60, startPage: 404, endPage: 410, revelationType: 'meccan' },
  { number: 31, nameArabic: 'لقمان', nameEnglish: 'Luqman', nameRussian: 'Лукман', meaningEnglish: 'Luqman', meaningRussian: 'Лукман', versesCount: 34, startPage: 411, endPage: 414, revelationType: 'meccan' },
  { number: 32, nameArabic: 'السجدة', nameEnglish: 'As-Sajdah', nameRussian: 'Ас-Саджда', meaningEnglish: 'The Prostration', meaningRussian: 'Поклон', versesCount: 30, startPage: 415, endPage: 417, revelationType: 'meccan' },
  { number: 33, nameArabic: 'الأحزاب', nameEnglish: 'Al-Ahzab', nameRussian: 'Аль-Ахзаб', meaningEnglish: 'The Combined Forces', meaningRussian: 'Союзники', versesCount: 73, startPage: 418, endPage: 427, revelationType: 'medinan' },
  { number: 34, nameArabic: 'سبأ', nameEnglish: 'Saba', nameRussian: 'Саба', meaningEnglish: 'Sheba', meaningRussian: 'Сава', versesCount: 54, startPage: 428, endPage: 434, revelationType: 'meccan' },
  { number: 35, nameArabic: 'فاطر', nameEnglish: 'Fatir', nameRussian: 'Фатыр', meaningEnglish: 'Originator', meaningRussian: 'Творец', versesCount: 45, startPage: 434, endPage: 440, revelationType: 'meccan' },
  { number: 36, nameArabic: 'يس', nameEnglish: 'Ya-Sin', nameRussian: 'Йа Син', meaningEnglish: 'Ya Sin', meaningRussian: 'Йа Син', versesCount: 83, startPage: 440, endPage: 445, revelationType: 'meccan' },
  { number: 37, nameArabic: 'الصافات', nameEnglish: 'As-Saffat', nameRussian: 'Ас-Саффат', meaningEnglish: 'Those who set the Ranks', meaningRussian: 'Стоящие в ряд', versesCount: 182, startPage: 446, endPage: 452, revelationType: 'meccan' },
  { number: 38, nameArabic: 'ص', nameEnglish: 'Sad', nameRussian: 'Сад', meaningEnglish: 'The Letter Sad', meaningRussian: 'Сад', versesCount: 88, startPage: 453, endPage: 458, revelationType: 'meccan' },
  { number: 39, nameArabic: 'الزمر', nameEnglish: 'Az-Zumar', nameRussian: 'Аз-Зумар', meaningEnglish: 'The Troops', meaningRussian: 'Толпы', versesCount: 75, startPage: 458, endPage: 467, revelationType: 'meccan' },
  { number: 40, nameArabic: 'غافر', nameEnglish: 'Ghafir', nameRussian: 'Гафир', meaningEnglish: 'The Forgiver', meaningRussian: 'Прощающий', versesCount: 85, startPage: 467, endPage: 476, revelationType: 'meccan' },
  { number: 41, nameArabic: 'فصلت', nameEnglish: 'Fussilat', nameRussian: 'Фуссылят', meaningEnglish: 'Explained in Detail', meaningRussian: 'Разъяснены', versesCount: 54, startPage: 477, endPage: 482, revelationType: 'meccan' },
  { number: 42, nameArabic: 'الشورى', nameEnglish: 'Ash-Shura', nameRussian: 'Аш-Шура', meaningEnglish: 'The Consultation', meaningRussian: 'Совет', versesCount: 53, startPage: 483, endPage: 489, revelationType: 'meccan' },
  { number: 43, nameArabic: 'الزخرف', nameEnglish: 'Az-Zukhruf', nameRussian: 'Аз-Зухруф', meaningEnglish: 'The Ornaments of Gold', meaningRussian: 'Украшения', versesCount: 89, startPage: 489, endPage: 495, revelationType: 'meccan' },
  { number: 44, nameArabic: 'الدخان', nameEnglish: 'Ad-Dukhan', nameRussian: 'Ад-Духан', meaningEnglish: 'The Smoke', meaningRussian: 'Дым', versesCount: 59, startPage: 496, endPage: 498, revelationType: 'meccan' },
  { number: 45, nameArabic: 'الجاثية', nameEnglish: 'Al-Jathiyah', nameRussian: 'Аль-Джасия', meaningEnglish: 'The Crouching', meaningRussian: 'Коленопреклонённые', versesCount: 37, startPage: 499, endPage: 502, revelationType: 'meccan' },
  { number: 46, nameArabic: 'الأحقاف', nameEnglish: 'Al-Ahqaf', nameRussian: 'Аль-Ахкаф', meaningEnglish: 'The Wind-Curved Sandhills', meaningRussian: 'Барханы', versesCount: 35, startPage: 502, endPage: 506, revelationType: 'meccan' },
  { number: 47, nameArabic: 'محمد', nameEnglish: 'Muhammad', nameRussian: 'Мухаммад', meaningEnglish: 'Muhammad', meaningRussian: 'Мухаммад', versesCount: 38, startPage: 507, endPage: 510, revelationType: 'medinan' },
  { number: 48, nameArabic: 'الفتح', nameEnglish: 'Al-Fath', nameRussian: 'Аль-Фатх', meaningEnglish: 'The Victory', meaningRussian: 'Победа', versesCount: 29, startPage: 511, endPage: 515, revelationType: 'medinan' },
  { number: 49, nameArabic: 'الحجرات', nameEnglish: 'Al-Hujurat', nameRussian: 'Аль-Худжурат', meaningEnglish: 'The Rooms', meaningRussian: 'Комнаты', versesCount: 18, startPage: 515, endPage: 517, revelationType: 'medinan' },
  { number: 50, nameArabic: 'ق', nameEnglish: 'Qaf', nameRussian: 'Каф', meaningEnglish: 'The Letter Qaf', meaningRussian: 'Каф', versesCount: 45, startPage: 518, endPage: 520, revelationType: 'meccan' },
  { number: 51, nameArabic: 'الذاريات', nameEnglish: 'Adh-Dhariyat', nameRussian: 'Аз-Зарият', meaningEnglish: 'The Winnowing Winds', meaningRussian: 'Рассеивающие', versesCount: 60, startPage: 520, endPage: 523, revelationType: 'meccan' },
  { number: 52, nameArabic: 'الطور', nameEnglish: 'At-Tur', nameRussian: 'Ат-Тур', meaningEnglish: 'The Mount', meaningRussian: 'Гора', versesCount: 49, startPage: 523, endPage: 525, revelationType: 'meccan' },
  { number: 53, nameArabic: 'النجم', nameEnglish: 'An-Najm', nameRussian: 'Ан-Наджм', meaningEnglish: 'The Star', meaningRussian: 'Звезда', versesCount: 62, startPage: 526, endPage: 528, revelationType: 'meccan' },
  { number: 54, nameArabic: 'القمر', nameEnglish: 'Al-Qamar', nameRussian: 'Аль-Камар', meaningEnglish: 'The Moon', meaningRussian: 'Луна', versesCount: 55, startPage: 528, endPage: 531, revelationType: 'meccan' },
  { number: 55, nameArabic: 'الرحمن', nameEnglish: 'Ar-Rahman', nameRussian: 'Ар-Рахман', meaningEnglish: 'The Beneficent', meaningRussian: 'Милостивый', versesCount: 78, startPage: 531, endPage: 534, revelationType: 'medinan' },
  { number: 56, nameArabic: 'الواقعة', nameEnglish: 'Al-Waqi\'ah', nameRussian: 'Аль-Вакиа', meaningEnglish: 'The Inevitable', meaningRussian: 'Событие', versesCount: 96, startPage: 534, endPage: 537, revelationType: 'meccan' },
  { number: 57, nameArabic: 'الحديد', nameEnglish: 'Al-Hadid', nameRussian: 'Аль-Хадид', meaningEnglish: 'The Iron', meaningRussian: 'Железо', versesCount: 29, startPage: 537, endPage: 541, revelationType: 'medinan' },
  { number: 58, nameArabic: 'المجادلة', nameEnglish: 'Al-Mujadila', nameRussian: 'Аль-Муджадила', meaningEnglish: 'The Pleading Woman', meaningRussian: 'Препирающаяся', versesCount: 22, startPage: 542, endPage: 545, revelationType: 'medinan' },
  { number: 59, nameArabic: 'الحشر', nameEnglish: 'Al-Hashr', nameRussian: 'Аль-Хашр', meaningEnglish: 'The Exile', meaningRussian: 'Сбор', versesCount: 24, startPage: 545, endPage: 548, revelationType: 'medinan' },
  { number: 60, nameArabic: 'الممتحنة', nameEnglish: 'Al-Mumtahanah', nameRussian: 'Аль-Мумтахана', meaningEnglish: 'The Woman to be Examined', meaningRussian: 'Испытуемая', versesCount: 13, startPage: 549, endPage: 551, revelationType: 'medinan' },
  { number: 61, nameArabic: 'الصف', nameEnglish: 'As-Saff', nameRussian: 'Ас-Сафф', meaningEnglish: 'The Ranks', meaningRussian: 'Ряды', versesCount: 14, startPage: 551, endPage: 552, revelationType: 'medinan' },
  { number: 62, nameArabic: 'الجمعة', nameEnglish: 'Al-Jumu\'ah', nameRussian: 'Аль-Джумуа', meaningEnglish: 'The Congregation', meaningRussian: 'Пятница', versesCount: 11, startPage: 553, endPage: 554, revelationType: 'medinan' },
  { number: 63, nameArabic: 'المنافقون', nameEnglish: 'Al-Munafiqun', nameRussian: 'Аль-Мунафикун', meaningEnglish: 'The Hypocrites', meaningRussian: 'Лицемеры', versesCount: 11, startPage: 554, endPage: 555, revelationType: 'medinan' },
  { number: 64, nameArabic: 'التغابن', nameEnglish: 'At-Taghabun', nameRussian: 'Ат-Тагабун', meaningEnglish: 'The Mutual Disillusion', meaningRussian: 'Взаимное обделение', versesCount: 18, startPage: 556, endPage: 557, revelationType: 'medinan' },
  { number: 65, nameArabic: 'الطلاق', nameEnglish: 'At-Talaq', nameRussian: 'Ат-Талак', meaningEnglish: 'The Divorce', meaningRussian: 'Развод', versesCount: 12, startPage: 558, endPage: 559, revelationType: 'medinan' },
  { number: 66, nameArabic: 'التحريم', nameEnglish: 'At-Tahrim', nameRussian: 'Ат-Тахрим', meaningEnglish: 'The Prohibition', meaningRussian: 'Запрещение', versesCount: 12, startPage: 560, endPage: 561, revelationType: 'medinan' },
  { number: 67, nameArabic: 'الملك', nameEnglish: 'Al-Mulk', nameRussian: 'Аль-Мульк', meaningEnglish: 'The Sovereignty', meaningRussian: 'Власть', versesCount: 30, startPage: 562, endPage: 564, revelationType: 'meccan' },
  { number: 68, nameArabic: 'القلم', nameEnglish: 'Al-Qalam', nameRussian: 'Аль-Калам', meaningEnglish: 'The Pen', meaningRussian: 'Калам', versesCount: 52, startPage: 564, endPage: 566, revelationType: 'meccan' },
  { number: 69, nameArabic: 'الحاقة', nameEnglish: 'Al-Haqqah', nameRussian: 'Аль-Хакка', meaningEnglish: 'The Reality', meaningRussian: 'Неизбежное', versesCount: 52, startPage: 566, endPage: 568, revelationType: 'meccan' },
  { number: 70, nameArabic: 'المعارج', nameEnglish: 'Al-Ma\'arij', nameRussian: 'Аль-Маариж', meaningEnglish: 'The Ascending Stairways', meaningRussian: 'Ступени', versesCount: 44, startPage: 568, endPage: 570, revelationType: 'meccan' },
  { number: 71, nameArabic: 'نوح', nameEnglish: 'Nuh', nameRussian: 'Нух', meaningEnglish: 'Noah', meaningRussian: 'Ной', versesCount: 28, startPage: 570, endPage: 571, revelationType: 'meccan' },
  { number: 72, nameArabic: 'الجن', nameEnglish: 'Al-Jinn', nameRussian: 'Аль-Джинн', meaningEnglish: 'The Jinn', meaningRussian: 'Джинны', versesCount: 28, startPage: 572, endPage: 573, revelationType: 'meccan' },
  { number: 73, nameArabic: 'المزمل', nameEnglish: 'Al-Muzzammil', nameRussian: 'Аль-Муззаммиль', meaningEnglish: 'The Enshrouded One', meaningRussian: 'Закутавшийся', versesCount: 20, startPage: 574, endPage: 575, revelationType: 'meccan' },
  { number: 74, nameArabic: 'المدثر', nameEnglish: 'Al-Muddaththir', nameRussian: 'Аль-Муддассир', meaningEnglish: 'The Cloaked One', meaningRussian: 'Завернувшийся', versesCount: 56, startPage: 575, endPage: 577, revelationType: 'meccan' },
  { number: 75, nameArabic: 'القيامة', nameEnglish: 'Al-Qiyamah', nameRussian: 'Аль-Кыяма', meaningEnglish: 'The Resurrection', meaningRussian: 'Воскресение', versesCount: 40, startPage: 577, endPage: 578, revelationType: 'meccan' },
  { number: 76, nameArabic: 'الإنسان', nameEnglish: 'Al-Insan', nameRussian: 'Аль-Инсан', meaningEnglish: 'The Man', meaningRussian: 'Человек', versesCount: 31, startPage: 578, endPage: 580, revelationType: 'medinan' },
  { number: 77, nameArabic: 'المرسلات', nameEnglish: 'Al-Mursalat', nameRussian: 'Аль-Мурсалят', meaningEnglish: 'The Emissaries', meaningRussian: 'Посылаемые', versesCount: 50, startPage: 580, endPage: 581, revelationType: 'meccan' },
  { number: 78, nameArabic: 'النبأ', nameEnglish: 'An-Naba', nameRussian: 'Ан-Наба', meaningEnglish: 'The Tidings', meaningRussian: 'Весть', versesCount: 40, startPage: 582, endPage: 583, revelationType: 'meccan' },
  { number: 79, nameArabic: 'النازعات', nameEnglish: 'An-Nazi\'at', nameRussian: 'Ан-Назиат', meaningEnglish: 'Those who drag forth', meaningRussian: 'Вырывающие', versesCount: 46, startPage: 583, endPage: 584, revelationType: 'meccan' },
  { number: 80, nameArabic: 'عبس', nameEnglish: '\'Abasa', nameRussian: 'Абаса', meaningEnglish: 'He Frowned', meaningRussian: 'Нахмурился', versesCount: 42, startPage: 585, endPage: 586, revelationType: 'meccan' },
  { number: 81, nameArabic: 'التكوير', nameEnglish: 'At-Takwir', nameRussian: 'Ат-Таквир', meaningEnglish: 'The Overthrowing', meaningRussian: 'Скручивание', versesCount: 29, startPage: 586, endPage: 586, revelationType: 'meccan' },
  { number: 82, nameArabic: 'الإنفطار', nameEnglish: 'Al-Infitar', nameRussian: 'Аль-Инфитар', meaningEnglish: 'The Cleaving', meaningRussian: 'Раскалывание', versesCount: 19, startPage: 587, endPage: 587, revelationType: 'meccan' },
  { number: 83, nameArabic: 'المطففين', nameEnglish: 'Al-Mutaffifin', nameRussian: 'Аль-Мутаффифин', meaningEnglish: 'The Defrauding', meaningRussian: 'Обвешивающие', versesCount: 36, startPage: 587, endPage: 589, revelationType: 'meccan' },
  { number: 84, nameArabic: 'الإنشقاق', nameEnglish: 'Al-Inshiqaq', nameRussian: 'Аль-Иншикак', meaningEnglish: 'The Sundering', meaningRussian: 'Разверзнется', versesCount: 25, startPage: 589, endPage: 589, revelationType: 'meccan' },
  { number: 85, nameArabic: 'البروج', nameEnglish: 'Al-Buruj', nameRussian: 'Аль-Бурудж', meaningEnglish: 'The Mansions of the Stars', meaningRussian: 'Созвездия', versesCount: 22, startPage: 590, endPage: 590, revelationType: 'meccan' },
  { number: 86, nameArabic: 'الطارق', nameEnglish: 'At-Tariq', nameRussian: 'Ат-Тарик', meaningEnglish: 'The Nightcomer', meaningRussian: 'Ночной путник', versesCount: 17, startPage: 591, endPage: 591, revelationType: 'meccan' },
  { number: 87, nameArabic: 'الأعلى', nameEnglish: 'Al-A\'la', nameRussian: 'Аль-Аля', meaningEnglish: 'The Most High', meaningRussian: 'Всевышний', versesCount: 19, startPage: 591, endPage: 592, revelationType: 'meccan' },
  { number: 88, nameArabic: 'الغاشية', nameEnglish: 'Al-Ghashiyah', nameRussian: 'Аль-Гашия', meaningEnglish: 'The Overwhelming', meaningRussian: 'Покрывающее', versesCount: 26, startPage: 592, endPage: 592, revelationType: 'meccan' },
  { number: 89, nameArabic: 'الفجر', nameEnglish: 'Al-Fajr', nameRussian: 'Аль-Фаджр', meaningEnglish: 'The Dawn', meaningRussian: 'Заря', versesCount: 30, startPage: 593, endPage: 594, revelationType: 'meccan' },
  { number: 90, nameArabic: 'البلد', nameEnglish: 'Al-Balad', nameRussian: 'Аль-Баляд', meaningEnglish: 'The City', meaningRussian: 'Город', versesCount: 20, startPage: 594, endPage: 594, revelationType: 'meccan' },
  { number: 91, nameArabic: 'الشمس', nameEnglish: 'Ash-Shams', nameRussian: 'Аш-Шамс', meaningEnglish: 'The Sun', meaningRussian: 'Солнце', versesCount: 15, startPage: 595, endPage: 595, revelationType: 'meccan' },
  { number: 92, nameArabic: 'الليل', nameEnglish: 'Al-Layl', nameRussian: 'Аль-Лейль', meaningEnglish: 'The Night', meaningRussian: 'Ночь', versesCount: 21, startPage: 595, endPage: 596, revelationType: 'meccan' },
  { number: 93, nameArabic: 'الضحى', nameEnglish: 'Ad-Duhaa', nameRussian: 'Ад-Духа', meaningEnglish: 'The Morning Hours', meaningRussian: 'Утро', versesCount: 11, startPage: 596, endPage: 596, revelationType: 'meccan' },
  { number: 94, nameArabic: 'الشرح', nameEnglish: 'Ash-Sharh', nameRussian: 'Аш-Шарх', meaningEnglish: 'The Relief', meaningRussian: 'Раскрытие', versesCount: 8, startPage: 596, endPage: 596, revelationType: 'meccan' },
  { number: 95, nameArabic: 'التين', nameEnglish: 'At-Tin', nameRussian: 'Ат-Тин', meaningEnglish: 'The Fig', meaningRussian: 'Смоковница', versesCount: 8, startPage: 597, endPage: 597, revelationType: 'meccan' },
  { number: 96, nameArabic: 'العلق', nameEnglish: 'Al-\'Alaq', nameRussian: 'Аль-Алак', meaningEnglish: 'The Clot', meaningRussian: 'Сгусток', versesCount: 19, startPage: 597, endPage: 597, revelationType: 'meccan' },
  { number: 97, nameArabic: 'القدر', nameEnglish: 'Al-Qadr', nameRussian: 'Аль-Кадр', meaningEnglish: 'The Power', meaningRussian: 'Предопределение', versesCount: 5, startPage: 598, endPage: 598, revelationType: 'meccan' },
  { number: 98, nameArabic: 'البينة', nameEnglish: 'Al-Bayyinah', nameRussian: 'Аль-Баййина', meaningEnglish: 'The Clear Proof', meaningRussian: 'Ясное знамение', versesCount: 8, startPage: 598, endPage: 599, revelationType: 'medinan' },
  { number: 99, nameArabic: 'الزلزلة', nameEnglish: 'Az-Zalzalah', nameRussian: 'Аз-Зальзаля', meaningEnglish: 'The Earthquake', meaningRussian: 'Землетрясение', versesCount: 8, startPage: 599, endPage: 599, revelationType: 'medinan' },
  { number: 100, nameArabic: 'العاديات', nameEnglish: 'Al-\'Adiyat', nameRussian: 'Аль-Адият', meaningEnglish: 'The Courser', meaningRussian: 'Скачущие', versesCount: 11, startPage: 599, endPage: 600, revelationType: 'meccan' },
  { number: 101, nameArabic: 'القارعة', nameEnglish: 'Al-Qari\'ah', nameRussian: 'Аль-Кариа', meaningEnglish: 'The Calamity', meaningRussian: 'Поражающее', versesCount: 11, startPage: 600, endPage: 600, revelationType: 'meccan' },
  { number: 102, nameArabic: 'التكاثر', nameEnglish: 'At-Takathur', nameRussian: 'Ат-Такасур', meaningEnglish: 'The Rivalry in world increase', meaningRussian: 'Страсть к приумножению', versesCount: 8, startPage: 600, endPage: 600, revelationType: 'meccan' },
  { number: 103, nameArabic: 'العصر', nameEnglish: 'Al-\'Asr', nameRussian: 'Аль-Аср', meaningEnglish: 'The Declining Day', meaningRussian: 'Предвечернее время', versesCount: 3, startPage: 601, endPage: 601, revelationType: 'meccan' },
  { number: 104, nameArabic: 'الهمزة', nameEnglish: 'Al-Humazah', nameRussian: 'Аль-Хумаза', meaningEnglish: 'The Traducer', meaningRussian: 'Хулитель', versesCount: 9, startPage: 601, endPage: 601, revelationType: 'meccan' },
  { number: 105, nameArabic: 'الفيل', nameEnglish: 'Al-Fil', nameRussian: 'Аль-Филь', meaningEnglish: 'The Elephant', meaningRussian: 'Слон', versesCount: 5, startPage: 601, endPage: 601, revelationType: 'meccan' },
  { number: 106, nameArabic: 'قريش', nameEnglish: 'Quraysh', nameRussian: 'Курайш', meaningEnglish: 'Quraysh', meaningRussian: 'Курайшиты', versesCount: 4, startPage: 602, endPage: 602, revelationType: 'meccan' },
  { number: 107, nameArabic: 'الماعون', nameEnglish: 'Al-Ma\'un', nameRussian: 'Аль-Маун', meaningEnglish: 'The Small Kindnesses', meaningRussian: 'Милостыня', versesCount: 7, startPage: 602, endPage: 602, revelationType: 'meccan' },
  { number: 108, nameArabic: 'الكوثر', nameEnglish: 'Al-Kawthar', nameRussian: 'Аль-Каусар', meaningEnglish: 'The Abundance', meaningRussian: 'Изобилие', versesCount: 3, startPage: 602, endPage: 602, revelationType: 'meccan' },
  { number: 109, nameArabic: 'الكافرون', nameEnglish: 'Al-Kafirun', nameRussian: 'Аль-Кафирун', meaningEnglish: 'The Disbelievers', meaningRussian: 'Неверующие', versesCount: 6, startPage: 603, endPage: 603, revelationType: 'meccan' },
  { number: 110, nameArabic: 'النصر', nameEnglish: 'An-Nasr', nameRussian: 'Ан-Наср', meaningEnglish: 'The Divine Support', meaningRussian: 'Помощь', versesCount: 3, startPage: 603, endPage: 603, revelationType: 'medinan' },
  { number: 111, nameArabic: 'المسد', nameEnglish: 'Al-Masad', nameRussian: 'Аль-Масад', meaningEnglish: 'The Palm Fiber', meaningRussian: 'Пальмовые волокна', versesCount: 5, startPage: 603, endPage: 603, revelationType: 'meccan' },
  { number: 112, nameArabic: 'الإخلاص', nameEnglish: 'Al-Ikhlas', nameRussian: 'Аль-Ихляс', meaningEnglish: 'The Sincerity', meaningRussian: 'Искренность', versesCount: 4, startPage: 604, endPage: 604, revelationType: 'meccan' },
  { number: 113, nameArabic: 'الفلق', nameEnglish: 'Al-Falaq', nameRussian: 'Аль-Фаляк', meaningEnglish: 'The Daybreak', meaningRussian: 'Рассвет', versesCount: 5, startPage: 604, endPage: 604, revelationType: 'meccan' },
  { number: 114, nameArabic: 'الناس', nameEnglish: 'An-Nas', nameRussian: 'Ан-Нас', meaningEnglish: 'Mankind', meaningRussian: 'Люди', versesCount: 6, startPage: 604, endPage: 604, revelationType: 'meccan' },
]

/**
 * Get surah info by page number
 * Returns the surah(s) that appear on this page
 */
export function getSurahsByPage(pageNumber: number): SurahInfo[] {
  return SURAHS.filter(
    surah => pageNumber >= surah.startPage && pageNumber <= surah.endPage
  )
}

/**
 * Get primary surah for a page (the one that starts first)
 */
export function getPrimarySurahByPage(pageNumber: number): SurahInfo | null {
  const surahs = getSurahsByPage(pageNumber)
  if (surahs.length === 0) return null

  // Return the surah that started earliest on or before this page
  return surahs.reduce((earliest, current) =>
    current.startPage <= earliest.startPage ? current : earliest
  )
}

/**
 * Get surah by number
 */
export function getSurahByNumber(number: number): SurahInfo | null {
  return SURAHS.find(s => s.number === number) || null
}

/**
 * Get all surahs
 */
export function getAllSurahs(): SurahInfo[] {
  return SURAHS
}
