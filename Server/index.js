const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { config } = require('./config');
const { initDb } = require('./db/db');
const { seedIfEmpty } = require('./db/seed');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errors');

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: true, // Разрешаем запросы с клиента (localhost:3000)
    credentials: true, // Важно! Разрешает передачу куки
  })
);

// Подключаем все роуты (без префикса /api, как ты и просила)
app.use(apiRoutes);

// Обработка ошибок (должна быть в самом конце)
app.use(notFoundHandler);
app.use(errorHandler);

// Запуск сервера
const port = config.port;

(async () => {
  try {
    await initDb();
    console.log('Database initialized successfully');
    
    await seedIfEmpty();
    console.log('Database seeded (if empty)');
    
    app.listen(port, () => {
      console.log(`Server listening on port ${port}!`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
})();