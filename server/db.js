// db.js: підключення до бази даних і створення таблиць.
// Використовуємо SQLite, яка вбудована в Node.js (модуль node:sqlite).
// Уся база це один файл barbershop.db поруч із цим кодом.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

// Створює файл бази, якщо його ще немає
const db = new DatabaseSync(path.join(__dirname, 'barbershop.db'));

// Вмикаємо перевірку зв'язків між таблицями
// (не можна вказати майстра чи послугу, яких не існує)
db.exec('PRAGMA foreign_keys = ON');

// ==========================================
// ТАБЛИЦІ
// ==========================================
// IF NOT EXISTS означає: створити, тільки якщо таблиці ще немає.
// Тому цей код безпечно запускати щоразу при старті сервера.

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id         TEXT PRIMARY KEY,      -- 'barber', 'senior', 'top'
    name       TEXT NOT NULL,         -- 'Барбер'
    sort_order INTEGER NOT NULL       -- порядок показу
  );

  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    duration    INTEGER NOT NULL      -- тривалість у хвилинах
  );

  CREATE TABLE IF NOT EXISTS barbers (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    category_id      TEXT NOT NULL REFERENCES categories(id),
    experience_years INTEGER NOT NULL,
    description      TEXT NOT NULL,
    photo            TEXT             -- шлях до фото на сайті
  );

  -- Прайс: яка послуга за яку ціну в якого майстра.
  -- Пара (barber_id, service_id) не може повторюватися.
  CREATE TABLE IF NOT EXISTS barber_services (
    barber_id  INTEGER NOT NULL REFERENCES barbers(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    price      INTEGER NOT NULL,
    PRIMARY KEY (barber_id, service_id)
  );

  -- Записи клієнтів. Поки порожня: наповнимо на наступному кроці.
  CREATE TABLE IF NOT EXISTS bookings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE, -- код запису для клієнта
    client_name TEXT NOT NULL,
    phone       TEXT NOT NULL,
    service_id  INTEGER NOT NULL REFERENCES services(id),
    barber_id   INTEGER NOT NULL REFERENCES barbers(id),
    price       INTEGER NOT NULL,     -- ціна на момент запису
    date        TEXT NOT NULL,        -- '2026-11-05'
    start_time  TEXT NOT NULL,        -- '14:00'
    end_time    TEXT NOT NULL,        -- '14:45'
    status      TEXT NOT NULL DEFAULT 'active',  -- 'active' або 'cancelled'
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// ==========================================
// ПОЧАТКОВІ ДАНІ (виконуються лише для порожньої бази)
// ==========================================

const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get();

if (count === 0) {
  const insertCategory = db.prepare(
    'INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)'
  );
  const insertService = db.prepare(
    'INSERT INTO services (title, description, duration) VALUES (?, ?, ?)'
  );
  const insertBarber = db.prepare(
    `INSERT INTO barbers (name, category_id, experience_years, description, photo)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertPrice = db.prepare(
    'INSERT INTO barber_services (barber_id, service_id, price) VALUES (?, ?, ?)'
  );

  // Транзакція: або вставляється все, або нічого.
  db.exec('BEGIN');

  insertCategory.run('barber', 'Барбер', 1);
  insertCategory.run('senior', 'Старший барбер', 2);
  insertCategory.run('top', 'Топ барбер', 3);

  insertService.run(
    'Чоловіча стрижка',
    'Індивідуальний підбір форми з урахуванням структури волосся та особливостей обличчя. Послуга включає миття голови, точну стрижку та фінальну укладку.',
    45
  );
  insertService.run(
    'Оформлення бороди',
    'Створення чітких контурів та надання ідеальної форми вашій бороді. Процедура супроводжується розпарюванням гарячим рушником.',
    30
  );
  insertService.run(
    'Стрижка + Борода',
    'Повне оновлення вашого образу в одному візиті за вигідною ціною. Включає моделювання зачіски та повний спектр доглядових процедур.',
    75
  );

  insertBarber.run(
    'Олександр', 'senior', 5,
    'Досвід понад 5 років. Ідеально відчуває форму та допоможе підібрати стиль, який пасуватиме саме вам. Спеціаліст з небезпечної бритви.',
    'img/star_barber.jpeg'
  );
  insertBarber.run(
    'Дмитро', 'barber', 3,
    'Професіонал з класичних та сучасних стрижок (Fade, Crop). Знає все про правильний догляд за бородою та шкірою обличчя.',
    'img/barber.png'
  );
  insertBarber.run(
    'Максим', 'barber', 1,
    'Талановитий майстер, який завжди в курсі останніх трендів. Виконує роботу акуратно, старанно та з великою увагою до деталей.',
    'img/molod_barber.png'
  );

  // УВАГА: ціни тимчасові (взяті з поточного сайту, у старшого на 20% більше).
  // Замінити на реальні, коли подруга надішле прайс.
  // (майстер, послуга, ціна)
  insertPrice.run(1, 1, 600); insertPrice.run(1, 2, 420); insertPrice.run(1, 3, 960);
  insertPrice.run(2, 1, 500); insertPrice.run(2, 2, 350); insertPrice.run(2, 3, 800);
  insertPrice.run(3, 1, 500); insertPrice.run(3, 2, 350); insertPrice.run(3, 3, 800);

  db.exec('COMMIT');
  console.log('База даних створена і заповнена початковими даними.');
}

module.exports = db;