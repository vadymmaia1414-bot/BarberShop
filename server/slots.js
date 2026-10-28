// slots.js: правила часу та пошук вільних годин.

const db = require('./db');

// ==========================================
// НАЛАШТУВАННЯ (взято з футера сайту: щодня 10:00 - 21:00)
// ==========================================
const WORK_START = 10 * 60;   // 10:00 у хвилинах від початку доби = 600
const WORK_END = 21 * 60;     // 21:00 = 1260
const STEP = 30;              // записуємо на кожні 30 хвилин
const MAX_DAYS_AHEAD = 60;    // записатися можна не далі ніж на 60 днів
const TIMEZONE = 'Europe/Kyiv';

// ==========================================
// ПЕРЕТВОРЕННЯ ЧАСУ
// ==========================================
// Рахувати з хвилинами простіше, ніж з рядками "14:30".

// "14:30" -> 870
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// 870 -> "14:30"
function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Який зараз час у Києві (а не на комп'ютері сервера).
// Це важливо, коли сервер працює десь у світі за іншим часовим поясом.
function kyivNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute'))
  };
}

// ==========================================
// ПЕРЕВІРКА ДАТИ І ЧАСУ ВІД КЛІЄНТА
// ==========================================

// Повертає текст помилки або null, якщо дата правильна
function validateDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Дата має бути у форматі РРРР-ММ-ДД, наприклад 2026-11-05.';
  }

  // Перевіряємо, що така дата існує (наприклад, 2026-02-31 не існує)
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return 'Такої дати не існує.';
  }

  const today = kyivNow().date;
  if (date < today) {   // ISO-дати можна порівнювати як звичайні рядки
    return 'Не можна записатися на минулу дату.';
  }

  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + MAX_DAYS_AHEAD);
  if (date > limit.toISOString().slice(0, 10)) {
    return `Записатися можна не далі ніж на ${MAX_DAYS_AHEAD} днів уперед.`;
  }

  return null;
}

function isValidTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

// ==========================================
// ГОЛОВНА ФУНКЦІЯ: вільні години майстра
// ==========================================
// Повертає масив рядків, наприклад ["10:00", "10:30", "12:00"]
function getFreeSlots(barberId, date, durationMin) {
  // Усі активні записи цього майстра на цей день.
  // Скасовані (cancelled) не рахуємо: їхній час знову вільний.
  const busy = db
    .prepare(
      `SELECT start_time, end_time FROM bookings
       WHERE barber_id = ? AND date = ? AND status = 'active'`
    )
    .all(barberId, date)
    .map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));

  const now = kyivNow();
  const slots = [];

  // Перебираємо всі можливі початки: 10:00, 10:30, 11:00 ...
  // Послуга має закінчитися до закриття (start + тривалість <= 21:00).
  for (let start = WORK_START; start + durationMin <= WORK_END; start += STEP) {
    const end = start + durationMin;

    // Якщо дивимось на сьогодні, минулі години пропускаємо
    if (date === now.date && start <= now.minutes) continue;

    // Два проміжки перетинаються, якщо кожен починається до кінця іншого
    const overlaps = busy.some((b) => start < b.end && end > b.start);
    if (!overlaps) slots.push(toTime(start));
  }

  return slots;
}

module.exports = { getFreeSlots, validateDate, isValidTime, toMinutes, toTime };