const express = require('express');
const messageRouter = express.Router();
const requireAuth = require('../middleware/auth');
const { getMessagesByTopicId, getMessageById, addMessage, deleteMessage } = require("../db/messages");

// GET /message/:topicId - Получить все сообщения темы
messageRouter.get("/:topicId", async (req, res) => {
    try {
        const topicId = parseInt(req.params.topicId);
        const messages = await getMessagesByTopicId(topicId);
        res.status(200).json(messages);
    } catch (error) {
        console.error("Ошибка при получении сообщений:", error);
        res.status(500).json({ message: "Ошибка сервера при получении сообщений" });
    }
});

// POST /message/ - Создать сообщение (только для авторизованных)
messageRouter.post("/", requireAuth, async (req, res) => {
    try {
        const { topicId, text } = req.body;
        if (!topicId || !text) {
            return res.status(400).json({ message: "Тема и текст сообщения обязательны" });
        }

        // req.userId нам дает охранник (middleware)
        const newMessage = await addMessage(req.userId, topicId, text);
        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Ошибка при создании сообщения:", error);
        res.status(500).json({ message: "Ошибка сервера при создании сообщения" });
    }
});

// DELETE /message/:id - Удалить сообщение (только для авторизованных)
messageRouter.delete("/:id", requireAuth, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const message = await getMessageById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: "Сообщение не найдено" });
        }

        await deleteMessage(messageId);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Ошибка при удалении сообщения:", error);
        res.status(500).json({ message: "Ошибка сервера при удалении сообщения" });
    }
});

module.exports = messageRouter;