const express = require('express');
const md5 = require('md5');
const authRouter = express.Router();
const { getUserByEmail } = require("../db/users");
const { addToken, getUserIdByToken, deleteByToken } = require("../db/tokens");

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

// POST /auth/ - Вход
authRouter.post("/", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email и пароль обязательны" });
    }

    const user = await getUserByEmail(email);

    if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
    }

    if (user.password !== md5(password)) {
        return res.status(400).json({ message: "Пароль неверный" });
    }

    const token = await addToken(user.id);
    res.cookie(COOKIE_NAME, token, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({ ok: true });
});

// DELETE /auth/ - Выход
authRouter.delete("/", async (req, res) => {
    const token = req.cookies.token;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
    }

    await deleteByToken(token);
    res.clearCookie(COOKIE_NAME);

    res.status(200).json({ ok: true });
});

module.exports = authRouter;