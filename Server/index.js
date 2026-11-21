const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Подключаем все роутеры
const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const categoryRouter = require('./routes/category');
const topicRouter = require('./routes/topic');
const messageRouter = require('./routes/message');

const { initDb } = require('./db/db');

const app = express();

// Глобальные настройки (middleware)
app.use(express.json());
app.use(cookieParser());

app.use(
    cors({
        credentials: true,
        origin: true 
    })
);

// Базовая проверка, что сервер жив
app.get('/', (req, res) => {
    res.status(200).json({ ok: true });
});

// Привязываем роутеры к путям
app.use('/auth', authRouter);
app.use('/user', userRouter);
app.use('/category', categoryRouter);
app.use('/topic', topicRouter);
app.use('/message', messageRouter);

const port = process.env.PORT || 3001;

// Инициализация БД и запуск сервера
(async () => {
    try {
        await initDb();
        console.log('Database initialized successfully');
        
        app.listen(port, () => {
            console.log(`Server listening on port ${port}!`);
        });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
})();
