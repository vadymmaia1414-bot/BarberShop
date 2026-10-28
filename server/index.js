const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db');
const { getFreeSlots, validateDate, isValidTime, toMinutes, toTime } = require('./slots');

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ==========================================

// Приводить телефон до єдиного вигляду +380XXXXXXXXX.
// Повертає null, якщо це не український номер.
// Клієнт може написати "099 111 22 33" або "+38 (099) 111-22-33":
// після нормалізації це той самий номер.
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');          // залишаємо тільки цифри
  if (digits.length === 10 && digits.startsWith('0')) digits = '38' + digits;
  if (digits.length === 12 && digits.startsWith('380')) return '+' + digits;
  return null;
}

// Код запису: 6 символів без схожих літер і цифр (немає 0, O, 1, I)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  const exists = db.prepare('SELECT 1 FROM bookings WHERE code = ?');
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
  } while (exists.get(code));   // якщо раптом такий код уже є, генеруємо інший
  return code;
}

// ==========================================
// МАРШРУТИ: довідники
// ==========================================

app.get('/api/categories', (req, res) => {
  const rows = db
    .prepare('SELECT id, name FROM categories ORDER BY sort_order')
    .all();
  res.json(rows);
});

app.get('/api/services', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.description, s.duration,
              MIN(bs.price) AS priceFrom
       FROM services s
       LEFT JOIN barber_services bs ON bs.service_id = s.id
       GROUP BY s.id
       ORDER BY s.id`
    )
    .all();
  res.json(rows);
});

app.get('/api/barbers', (req, res) => {
  const { category } = req.query;

  let sql = `SELECT b.id, b.name, b.experience_years AS experienceYears,
                    b.description, b.photo,
                    c.id AS categoryId, c.name AS categoryName
             FROM barbers b
             JOIN categories c ON c.id = b.category_id`;
  const params = [];
  if (category) {
    sql += ' WHERE b.category_id = ?';
    params.push(category);
  }
  sql += ' ORDER BY b.id';

  const barbers = db.prepare(sql).all(...params);

  const priceQuery = db.prepare(
    'SELECT service_id AS serviceId, price FROM barber_services WHERE barber_id = ? ORDER BY service_id'
  );

  res.json(
    barbers.map((b) => ({
      id: b.id,
      name: b.name,
      category: { id: b.categoryId, name: b.categoryName },
      experienceYears: b.experienceYears,
      description: b.description,
      photo: b.photo,
      services: priceQuery.all(b.id)
    }))
  );
});

// ==========================================
// МАРШРУТ: вільні години
// GET /api/barbers/1/slots?date=2026-11-05&serviceId=1
// ==========================================
app.get('/api/barbers/:id/slots', (req, res) => {
  const barberId = Number(req.params.id);
  const { date, serviceId } = req.query;

  const barber = db.prepare('SELECT id FROM barbers WHERE id = ?').get(barberId);
  if (!barber) {
    return res.status(404).json({ error: 'Такого майстра не існує.' });
  }

  const dateError = validateDate(date);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  const service = db
    .prepare('SELECT id, duration FROM services WHERE id = ?')
    .get(Number(serviceId));
  if (!service) {
    return res.status(400).json({ error: 'Такої послуги не існує.' });
  }

  // Чи робить цей майстер цю послугу?
  const offered = db
    .prepare('SELECT 1 FROM barber_services WHERE barber_id = ? AND service_id = ?')
    .get(barberId, service.id);
  if (!offered) {
    return res.status(400).json({ error: 'Цей майстер не виконує обрану послугу.' });
  }

  res.json({
    date,
    barberId,
    serviceId: service.id,
    slots: getFreeSlots(barberId, date, service.duration)
  });
});

// ==========================================
// МАРШРУТ: створити запис
// POST /api/bookings
// ==========================================
app.post('/api/bookings', (req, res) => {
  const { clientName, phone, serviceId, barberId, date, time } = req.body;

  // --- 1. Перевіряємо дані від клієнта ---
  const name = typeof clientName === 'string' ? clientName.trim() : '';
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ error: "Вкажіть ім'я (від 2 до 50 символів)." });
  }

  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) {
    return res.status(400).json({ error: 'Вкажіть коректний український номер, наприклад +380991112233.' });
  }

  const dateError = validateDate(date);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  if (!isValidTime(time)) {
    return res.status(400).json({ error: 'Час має бути у форматі ГГ:ХХ, наприклад 14:30.' });
  }

  // --- 2. Перевіряємо, що послуга й майстер існують і пасують одне одному ---
  const service = db
    .prepare('SELECT id, title, duration FROM services WHERE id = ?')
    .get(Number(serviceId));
  if (!service) {
    return res.status(400).json({ error: 'Такої послуги не існує.' });
  }

  const barber = db
    .prepare('SELECT id, name FROM barbers WHERE id = ?')
    .get(Number(barberId));
  if (!barber) {
    return res.status(400).json({ error: 'Такого майстра не існує.' });
  }

  // Ціну беремо з бази, а не від клієнта: її не можна підробити
  const priceRow = db
    .prepare('SELECT price FROM barber_services WHERE barber_id = ? AND service_id = ?')
    .get(barber.id, service.id);
  if (!priceRow) {
    return res.status(400).json({ error: 'Цей майстер не виконує обрану послугу.' });
  }

  // --- 3. Перевіряємо, що цей час справді вільний, і зберігаємо ---
  // Усе нижче виконується без пауз (код синхронний), тому між перевіркою
  // і записом у базу інший запит не встигне "влізти".
  // Так двоє клієнтів не можуть одночасно зайняти ту саму годину.
  const freeSlots = getFreeSlots(barber.id, date, service.duration);
  if (!freeSlots.includes(time)) {
    return res.status(409).json({
      error: 'Цей час уже зайнятий або недоступний. Оберіть інший.'
    });
  }

  const endTime = toTime(toMinutes(time) + service.duration);
  const code = generateCode();

  db.prepare(
    `INSERT INTO bookings
       (code, client_name, phone, service_id, barber_id, price, date, start_time, end_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(code, name, cleanPhone, service.id, barber.id, priceRow.price, date, time, endTime);

  res.status(201).json({
    message: 'Запис створено',
    booking: {
      code,
      clientName: name,
      serviceTitle: service.title,
      barberName: barber.name,
      date,
      time,
      endTime,
      price: priceRow.price,
      status: 'active'
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер працює на http://localhost:${PORT}`);
});