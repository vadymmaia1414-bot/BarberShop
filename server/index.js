const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const services = [
  { id: 1, title: 'Чоловіча стрижка', price: 300, duration: '30 хв' },
  { id: 2, title: 'Стрижка бороди', price: 250, duration: '30 хв' }, 
  { id: 3, title: 'Стрижка вусів', price: 200, duration: '15 хв' },
  { id: 4, title: 'Комплексна стрижка', price: 500, duration: '60 хв' },
  { id: 5, title: 'Дитяча стрижка', price: 200, duration: '30 хв' },
  { id: 6, title: 'Стрижка з укладкою', price: 400, duration: '45 хв' },
  { id: 7, title: 'Стрижка + фарбування', price: 800, duration: '90 хв' },
  { id: 8, title: 'Стрижка + гоління', price: 600, duration: '60 хв' },
  { id: 9, title: 'Стрижка + масаж голови', price: 700, duration: '75 хв' }
];

const barbers = [ 
  { id: 1, name: 'Олександр', role: 'Top Barber', experience: '5 років' },
  { id: 2, name: 'Дмитро', role: 'Barber', experience: '3 роки' },
  { id: 3, name: 'Максим', role: 'Junior Barber', experience: '1 рік' }, // <--- Додано кома!
  { id: 4, name: 'Іван', role: 'Barber', experience: '2 роки' },
  { id: 5, name: 'Андрій', role: 'Top Barber', experience: '6 років' },
  { id: 6, name: 'Сергій', role: 'Barber', experience: '4 роки' }
];

const bookings = [];

// Маршрут для отримання послуг
app.get('/api/services', (req, res) => {
  res.json(services);
});

// Маршрут для отримання барберів
app.get('/api/barbers', (req, res) => {
  res.json(barbers);
});

// Маршрут для створення нового бронювання
app.post('/api/bookings', (req, res) => {
  const { clientName, phone, serviceId, barberId, date } = req.body;
  
  if (!clientName || !phone) {
    return res.status(400).json({ error: "Будь ласка, вкажіть ім'я та номер телефону!" });
  }

  const newBooking = {
    id: bookings.length + 1,
    clientName,
    phone,
    serviceId,
    barberId,
    date,
    createdAt: new Date(),
  };

  // Виправлено назву масиву з boookings на bookings
  bookings.push(newBooking);

  res.status(201).json({
    message: "Бронювання успішно створено!",
    booking: newBooking,
  });
});

// Маршрут для перегляду всіх заброньованих годин
app.get('/api/bookings', (req, res) => {
  res.json(bookings);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер працює на http://localhost:${PORT}`);
});