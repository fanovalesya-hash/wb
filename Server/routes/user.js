const express = require('express');
const userRouter = express.Router();
const requireAuth = require('../middleware/auth');
const { getUserByEmail, addUser, getUserById, updateUser } = require("../db/users");

// GET /user/ - Получить текущего пользователя (только для авторизованных)
userRouter.get("/", requireAuth, async (req, res) => {
    try {
        const user = await getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }
        // Убираем пароль из ответа, чтобы не светить его
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
    } catch (error) {
        console.error("Ошибка при получении пользователя:", error);
        res.status(500).json({ message: "Ошибка сервера при получении данных" });
    }
});

// POST /user/ - Регистрация (охранник не нужен, пользователь еще не вошел)
userRouter.post("/", async (req, res) => {
    try {
        const { nickname, email, password } = req.body;

        if (!nickname || !email || !password) {
            return res.status(400).json({ message: "Заполните все поля" });
        }

        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "Пользователь с таким email уже существует" });
        }

        const newUser = await addUser(nickname, email, password, 1);
        const { password: _, ...newUserWithoutPassword } = newUser;

        res.status(201).json(newUserWithoutPassword);
    } catch (error) {
        console.error("Ошибка при регистрации:", error);
        res.status(500).json({ message: "Ошибка сервера при регистрации" });
    }
});

// PUT /user/ - Обновление профиля (только для авторизованных)
userRouter.put("/", requireAuth, async (req, res) => {
    try {
        const { nickname, email, password } = req.body;
        const userId = req.userId; // Охранник уже проверил токен и положил сюда ID

        // Если меняем email, проверяем, не занят ли он кем-то другим
        if (email) {
            const existingUser = await getUserByEmail(email);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ message: "Этот email уже занят другим пользователем" });
            }
        }

        // Обновляем данные в БД (пароль обновится, только если его передали)
        await updateUser(userId, nickname, email, password || null);

        // Возвращаем свежие данные
        const updatedUser = await getUserById(userId);
        const { password: _, ...userWithoutPassword } = updatedUser;

        res.status(200).json({ 
            ok: true, 
            message: "Профиль успешно обновлен", 
            user: userWithoutPassword 
        });
    } catch (error) {
        console.error("Ошибка при обновлении профиля:", error);
        res.status(500).json({ message: "Ошибка сервера при обновлении профиля" });
    }
});

module.exports = userRouter;