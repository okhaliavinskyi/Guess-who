/**
 * UI copy for every supported language. Character names are localized separately
 * through `Character.localeNames`. Components read the active table with
 * `useStrings()` (see ./language.tsx); `strings` is the English default.
 */
import type { PoolId } from '../content/categories.ts';

export const LANGUAGES = ['en', 'ru', 'uk'] as const;
export type Lang = (typeof LANGUAGES)[number];

/** Native names shown in the language switcher. */
export const LANGUAGE_NAMES: Record<Lang, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  ru: { short: 'RU', name: 'Русский' },
  uk: { short: 'UA', name: 'Українська' },
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Russian/Ukrainian plural form index: one / few / many. */
function slavicPlural(n: number, [one, few, many]: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const en = {
  appName: 'Guess Who',
  tagline: 'Choose a category. Place your phone on your forehead after tapping Start.',
  language: 'Language',
  demoBadge: 'Demo content',
  demoNote: 'Only a few sample names per category for now — the full deck is coming soon.',
  categoriesLabel: 'Categories',
  moreWaysLabel: 'More ways to play',
  mixAndCustom: 'Or play with',
  customLabel: 'Custom word',
  customBlurb: 'Type any name or word',
  categories: {
    'movies-tv': { label: 'Movies & TV', blurb: 'Actors and screen stars' },
    music: { label: 'Music', blurb: 'Singers and music icons' },
    fictional: { label: 'Fictional Characters', blurb: 'Cartoons, books, games' },
    politics: { label: 'Politics', blurb: 'World leaders' },
    history: { label: 'History', blurb: 'Thinkers, artists, pioneers' },
    sports: { label: 'Sports', blurb: 'Legendary athletes' },
    mix: { label: 'Mix', blurb: 'Anything from all six' },
  } as Record<PoolId, { label: string; blurb: string }>,
  howToTitle: 'How to play',
  howToSteps: [
    'Everyone opens this page on their own phone and picks the same category.',
    'Tap Start and, within 5 seconds, hold the phone sideways on your forehead — screen facing your friends.',
    'Ask yes/no questions to work out who you are. Friends answer honestly.',
    'The name stays on screen until you tap Next. Take as long as you like.',
  ] as readonly string[],
  ready: 'Ready?',
  readyHint: 'Tap Start, then raise your phone to your forehead.',
  rotateHint: 'Turn your phone sideways — the game is played in landscape.',
  start: 'Start',
  back: 'Back',
  interrupted:
    'Countdown stopped because the app was hidden. Nothing was revealed — tap Start when ready.',
  namesInDeck: (n: number) => `${n} ${n === 1 ? 'name' : 'names'} in this deck`,
  countdownInstruction: 'Raise your phone — screen facing your friends.',
  countdownAnnouncement: (s: number) => `Get ready. Revealing in ${s} seconds.`,
  cancel: 'Cancel',
  next: 'Next',
  newWord: 'New word',
  changeCategory: 'Category',
  changeCategoryLabel: 'Change category',
  end: 'End',
  endLabel: 'End game',
  showPhoto: 'Show photo',
  showName: 'Show name',
  tapForPhoto: 'Tap to show photo',
  tapForName: 'Tap to show name',
  photoFailed: 'Photo unavailable',
  photoCredit: 'Photo',
  source: 'Source',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  wakeLockWarning: 'Your device may lock its screen. Increase Auto-Lock time in device settings.',
  customTitle: 'Custom word',
  customPrompt: 'Type a name or word for the player. It is never saved or sent anywhere.',
  customInputLabel: 'Name or word',
  customEmpty: 'Please type a name or word.',
  customTooLong: (max: number) => `Keep it to ${max} characters or fewer.`,
  customCounter: (n: number, max: number) => `${n}/${max}`,
  unavailableTitle: 'No names here yet',
  unavailableBody: 'This category has no names available right now. Please pick another one.',
  revealedLabel: 'Character',
  controlsLabel: 'Game controls',
  photoAlt: (name: string) => `Photo: ${name}`,
  documentTitle: 'Guess Who — party guessing game',
};

export type Strings = typeof en;

const ru: Strings = {
  appName: 'Угадай, кто я',
  tagline: 'Выбери категорию. Нажми «Старт» и приложи телефон ко лбу.',
  language: 'Язык',
  demoBadge: 'Демо-набор',
  demoNote: 'Пока только несколько имён в каждой категории — полный набор скоро.',
  categoriesLabel: 'Категории',
  moreWaysLabel: 'Другие способы играть',
  mixAndCustom: 'Или сыграй так',
  customLabel: 'Своё слово',
  customBlurb: 'Впиши любое имя или слово',
  categories: {
    'movies-tv': { label: 'Кино и ТВ', blurb: 'Актёры и звёзды экрана' },
    music: { label: 'Музыка', blurb: 'Певцы и музыкальные легенды' },
    fictional: { label: 'Персонажи', blurb: 'Мультфильмы, книги, игры' },
    politics: { label: 'Политика', blurb: 'Мировые лидеры' },
    history: { label: 'История', blurb: 'Мыслители, художники, первооткрыватели' },
    sports: { label: 'Спорт', blurb: 'Легендарные спортсмены' },
    mix: { label: 'Микс', blurb: 'Всё из шести категорий' },
  },
  howToTitle: 'Как играть',
  howToSteps: [
    'Каждый открывает эту страницу на своём телефоне и выбирает одну и ту же категорию.',
    'Нажми «Старт» и за 5 секунд приложи телефон ко лбу горизонтально — экраном к друзьям.',
    'Задавай вопросы «да/нет», чтобы понять, кто ты. Друзья отвечают честно.',
    'Имя остаётся на экране, пока не нажмёшь «Дальше». Думай сколько угодно.',
  ],
  ready: 'Готов?',
  readyHint: 'Нажми «Старт» и подними телефон ко лбу.',
  rotateHint: 'Поверни телефон горизонтально — играют в альбомной ориентации.',
  start: 'Старт',
  back: 'Назад',
  interrupted:
    'Отсчёт остановлен, потому что приложение было свёрнуто. Ничего не показано — нажми «Старт», когда будешь готов.',
  namesInDeck: (n: number) => `${n} ${slavicPlural(n, ['имя', 'имени', 'имён'])} в колоде`,
  countdownInstruction: 'Подними телефон — экраном к друзьям.',
  countdownAnnouncement: (s: number) => `Приготовься. Показ через ${s} сек.`,
  cancel: 'Отмена',
  next: 'Дальше',
  newWord: 'Новое слово',
  changeCategory: 'Меню',
  changeCategoryLabel: 'Сменить категорию',
  end: 'Конец',
  endLabel: 'Закончить игру',
  showPhoto: 'Фото',
  showName: 'Имя',
  tapForPhoto: 'Нажми — покажу фото',
  tapForName: 'Нажми — покажу имя',
  photoFailed: 'Фото недоступно',
  photoCredit: 'Фото',
  source: 'Источник',
  fullscreen: 'Во весь экран',
  exitFullscreen: 'Выйти из полноэкранного режима',
  wakeLockWarning: 'Экран может погаснуть. Увеличь время автоблокировки в настройках устройства.',
  customTitle: 'Своё слово',
  customPrompt:
    'Впиши имя или слово для игрока. Оно нигде не сохраняется и никуда не отправляется.',
  customInputLabel: 'Имя или слово',
  customEmpty: 'Впиши имя или слово.',
  customTooLong: (max: number) => `Не больше ${max} символов.`,
  customCounter: (n: number, max: number) => `${n}/${max}`,
  unavailableTitle: 'Здесь пока нет имён',
  unavailableBody: 'В этой категории сейчас нет доступных имён. Выбери другую.',
  revealedLabel: 'Персонаж',
  controlsLabel: 'Управление игрой',
  photoAlt: (name: string) => `Фото: ${name}`,
  documentTitle: 'Угадай, кто я — игра для компании',
};

const uk: Strings = {
  appName: 'Вгадай, хто я',
  tagline: 'Обери категорію. Натисни «Старт» і приклади телефон до чола.',
  language: 'Мова',
  demoBadge: 'Демо-набір',
  demoNote: 'Поки що лише кілька імен у кожній категорії — повний набір незабаром.',
  categoriesLabel: 'Категорії',
  moreWaysLabel: 'Інші способи грати',
  mixAndCustom: 'Або зіграй так',
  customLabel: 'Своє слово',
  customBlurb: 'Впиши будь-яке ім’я чи слово',
  categories: {
    'movies-tv': { label: 'Кіно і ТБ', blurb: 'Актори та зірки екрана' },
    music: { label: 'Музика', blurb: 'Співаки та музичні легенди' },
    fictional: { label: 'Персонажі', blurb: 'Мультфільми, книжки, ігри' },
    politics: { label: 'Політика', blurb: 'Світові лідери' },
    history: { label: 'Історія', blurb: 'Мислителі, митці, першовідкривачі' },
    sports: { label: 'Спорт', blurb: 'Легендарні спортсмени' },
    mix: { label: 'Мікс', blurb: 'Усе з шести категорій' },
  },
  howToTitle: 'Як грати',
  howToSteps: [
    'Кожен відкриває цю сторінку на своєму телефоні й обирає ту саму категорію.',
    'Натисни «Старт» і за 5 секунд приклади телефон до чола горизонтально — екраном до друзів.',
    'Став запитання «так/ні», щоб зрозуміти, хто ти. Друзі відповідають чесно.',
    'Ім’я залишається на екрані, доки не натиснеш «Далі». Думай скільки завгодно.',
  ],
  ready: 'Готовий?',
  readyHint: 'Натисни «Старт» і підніми телефон до чола.',
  rotateHint: 'Поверни телефон горизонтально — грають в альбомній орієнтації.',
  start: 'Старт',
  back: 'Назад',
  interrupted:
    'Відлік зупинено, бо застосунок було згорнуто. Нічого не показано — натисни «Старт», коли будеш готовий.',
  namesInDeck: (n: number) => `${n} ${slavicPlural(n, ['ім’я', 'імені', 'імен'])} у колоді`,
  countdownInstruction: 'Підніми телефон — екраном до друзів.',
  countdownAnnouncement: (s: number) => `Приготуйся. Показ через ${s} с.`,
  cancel: 'Скасувати',
  next: 'Далі',
  newWord: 'Нове слово',
  changeCategory: 'Меню',
  changeCategoryLabel: 'Змінити категорію',
  end: 'Кінець',
  endLabel: 'Завершити гру',
  showPhoto: 'Фото',
  showName: 'Ім’я',
  tapForPhoto: 'Натисни — покажу фото',
  tapForName: 'Натисни — покажу ім’я',
  photoFailed: 'Фото недоступне',
  photoCredit: 'Фото',
  source: 'Джерело',
  fullscreen: 'На весь екран',
  exitFullscreen: 'Вийти з повноекранного режиму',
  wakeLockWarning: 'Екран може згаснути. Збільш час автоблокування в налаштуваннях пристрою.',
  customTitle: 'Своє слово',
  customPrompt:
    'Впиши ім’я чи слово для гравця. Воно ніде не зберігається й нікуди не надсилається.',
  customInputLabel: 'Ім’я або слово',
  customEmpty: 'Впиши ім’я або слово.',
  customTooLong: (max: number) => `Не більше ${max} символів.`,
  customCounter: (n: number, max: number) => `${n}/${max}`,
  unavailableTitle: 'Тут поки немає імен',
  unavailableBody: 'У цій категорії зараз немає доступних імен. Обери іншу.',
  revealedLabel: 'Персонаж',
  controlsLabel: 'Керування грою',
  photoAlt: (name: string) => `Фото: ${name}`,
  documentTitle: 'Вгадай, хто я — гра для компанії',
};

export const STRINGS: Record<Lang, Strings> = { en, ru, uk };

/** English copy (default language). */
export const strings = en;
