const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// ДАНІ (поки що в пам'яті, без бази даних)
// ==========================================

// Категорії майстрів. "Молодший барбер" не додаємо:
// це тимчасова категорія, через 1-3 місяці майстра переводять у "Барбер".
const categories = [
  { id: 'barber', name: 'Барбер' },
  { id: 'senior', name: 'Старший барбер' },
  { id: 'top', name: 'Топ барбер' }
];

// Послуги. Ціна залежить від категорії майстра, тому prices це об'єкт.
// УВАГА: ціни тимчасові! Замінити на реальні з прайсу барбершопу.
const services = [
  { id: 1, title: 'Чоловіча стрижка',        duration: 30, prices: { barber: 300, senior: 380,  top: 450 } },
  { id: 2, title: 'Стрижка бороди',          duration: 30, prices: { barber: 250, senior: 310,  top: 380 } },
  { id: 3, title: 'Стрижка вусів',           duration: 15, prices: { barber: 200, senior: 250,  top: 300 } },
  { id: 4, title: 'Комплексна стрижка',      duration: 60, prices: { barber: 500, senior: 630,  top: 750 } },
  { id: 5, title: 'Дитяча стрижка',          duration: 30, prices: { barber: 200, senior: 250,  top: 300 } },
  { id: 6, title: 'Стрижка з укладкою',      duration: 45, prices: { barber: 400, senior: 500,  top: 600 } },
  { id: 7, title: 'Стрижка + фарбування',    duration: 90, prices: { barber: 800, senior: 1000, top: 1200 } },
  { id: 8, title: 'Стрижка + гоління',       duration: 60, prices: { barber: 600, senior: 750,  top: 900 } },
  { id: 9, title: 'Стрижка + масаж голови',  duration: 75, prices: { barber: 700, senior: 880,  top: 1050 } }
];

// Майстри. Кожен належить до однієї категорії (categoryId).
// Імена тимчасові.
const barbers = [
  { id: 1, name: 'Олександр', categoryId: 'top',    experienceYears: 5 },
  { id: 2, name: 'Дмитро',    categoryId: 'barber', experienceYears: 3 },
  { id: 3, name: 'Максим',    categoryId: 'barber', experienceYears: 1 },
  { id: 4, name: 'Іван',      categoryId: 'barber', experienceYears: 2 },
  { id: 5, name: 'Андрій',    categoryId: 'top',    experienceYears: 6 },
  { id: 6, name: 'Сергій',    categoryId: 'senior', experienceYears: 4 }
];

const bookings = [];

// ==========================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ==========================================

// Додає до майстра повний об'єкт категорії замість простого id
function withCategory(barber) {
  const category = categories.find((c) => c.id === barber.categoryId);
  return { ...barber, category };
}

// ==========================================
// МАРШРУТИ
// ==========================================

app.get('/api/categories', (req, res) => {
  res.json(categories);
});

app.get('/api/services', (req, res) => {
  res.json(services);
});

// Приклад: /api/barbers або /api/barbers?category=top
app.get('/api/barbers', (req, res) => {
  const { category } = req.query;

  let result = barbers;
  if (category) {
    result = barbers.filter((b) => b.categoryId === category);
  }

  res.json(result.map(withCategory));
});

app.post('/api/bookings', (req, res) => {
  const { clientName, phone, serviceId, barberId, date } = req.body;

  if (!clientName || !phone) {
    return res.status(400).json({ error: "Будь ласка, вкажіть ім'я та номер телефону!" });
  }

  // Number() перетворює "2" з форми на число 2
  const service = services.find((s) => s.id === Number(serviceId));
  if (!service) {
    return res.status(400).json({ error: 'Такої послуги не існує.' });
  }

  const barber = barbers.find((b) => b.id === Number(barberId));
  if (!barber) {
    return res.status(400).json({ error: 'Такого майстра не існує.' });
  }

  // Ціну рахує сервер, а не фронтенд, тому її не можна підробити
  const price = service.prices[barber.categoryId];

  const newBooking = {
    id: bookings.length + 1,
    clientName,
    phone,
    serviceId: service.id,
    serviceTitle: service.title,
    barberId: barber.id,
    barberName: barber.name,
    category: barber.categoryId,
    price,
    date,
    createdAt: new Date()
  };

  bookings.push(newBooking);

  res.status(201).json({
    message: 'Бронювання успішно створено!',
    booking: newBooking
  });
});

app.get('/api/bookings', (req, res) => {
  res.json(bookings);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер працює на http://localhost:${PORT}`);
});