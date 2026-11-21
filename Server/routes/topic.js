const express = require('express');
const topicRouter = express.Router();
const requireAuth = require('../middleware/auth');
const { getTopics, getTopicsByCategoryId, getTopicById, addTopic, deleteTopic } = require("../db/topics");

// GET /topic/ - Получить все темы
topicRouter.get("/", async (req, res) => {
    try {
        const { categoryId } = req.query;
        let topics;
        if (categoryId) {
            topics = await getTopicsByCategoryId(parseInt(categoryId));
        } else {
            topics = await getTopics();
        }
        res.status(200).json(topics);
    } catch (error) {
        console.error("Ошибка при получении тем:", error);
        res.status(500).json({ message: "Ошибка сервера при получении тем" });
    }
});

// GET /topic/:id - Получить одну тему
topicRouter.get("/:id", async (req, res) => {
    try {
        const topicId = parseInt(req.params.id);
        const topic = await getTopicById(topicId);
        if (!topic) {
            return res.status(404).json({ message: "Тема не найдена" });
        }
        res.status(200).json(topic);
    } catch (error) {
        console.error("Ошибка при получении темы:", error);
        res.status(500).json({ message: "Ошибка сервера при получении темы" });
    }
});

// POST /topic/ - Создать тему (только для авторизованных)
topicRouter.post("/", requireAuth, async (req, res) => {
    try {
        const { title, description, categoryId } = req.body;
        if (!title || !categoryId) {
            return res.status(400).json({ message: "Заголовок и категория обязательны" });
        }

        // req.userId нам дает охранник (middleware)
        const newTopic = await addTopic(title, description, categoryId, req.userId);
        res.status(201).json(newTopic);
    } catch (error) {
        console.error("Ошибка при создании темы:", error);
        res.status(500).json({ message: "Ошибка сервера при создании темы" });
    }
});

// DELETE /topic/:id - Удалить тему (только для авторизованных)
topicRouter.delete("/:id", requireAuth, async (req, res) => {
    try {
        const topicId = parseInt(req.params.id);
        const topic = await getTopicById(topicId);
        
        if (!topic) {
            return res.status(404).json({ message: "Тема не найдена" });
        }

        await deleteTopic(topicId);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Ошибка при удалении темы:", error);
        res.status(500).json({ message: "Ошибка сервера при удалении темы" });
    }
});

module.exports = topicRouter;