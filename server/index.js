const express = require('express');
const cors = require('cors');
const db = require('./db');   // наша база даних із файлу db.js

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// МАРШРУТИ
// ==========================================

// GET /api/categories: категорії майстрів
app.get('/api/categories', (req, res) => {
  const rows = db
    .prepare('SELECT id, name FROM categories ORDER BY sort_order')
    .all();
  res.json(rows);
});

// GET /api/services: послуги з мінімальною ціною серед майстрів
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

// GET /api/barbers або /api/barbers?category=top
app.get('/api/barbers', (req, res) => {
  const { category } = req.query;

  // Вибираємо майстрів разом із їхньою категорією.
  // Якщо передано ?category=..., додаємо умову WHERE.
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

  // Для кожного майстра дістаємо його прайс
  const priceQuery = db.prepare(
    'SELECT service_id AS serviceId, price FROM barber_services WHERE barber_id = ? ORDER BY service_id'
  );

  const result = barbers.map((b) => ({
    id: b.id,
    name: b.name,
    category: { id: b.categoryId, name: b.categoryName },
    experienceYears: b.experienceYears,
    description: b.description,
    photo: b.photo,
    services: priceQuery.all(b.id)
  }));

  res.json(result);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер працює на http://localhost:${PORT}`);
});