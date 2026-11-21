const express = require('express');
const categoryRouter = express.Router();
const requireAuth = require('../middleware/auth');
const { getCategories, addCategory, getCategoryById, deleteCategory } = require("../db/categories");

// GET /category/ - Получить все категории
categoryRouter.get("/", async (req, res) => {
    try {
        const categories = await getCategories();
        res.status(200).json(categories);
    } catch (error) {
        console.error("Ошибка при получении категорий:", error);
        res.status(500).json({ message: "Ошибка сервера при получении категорий" });
    }
});

// POST /category/ - Создать категорию (только для авторизованных)
categoryRouter.post("/", requireAuth, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Название категории обязательно" });
        }

        const newCategory = await addCategory(name, description);
        res.status(201).json(newCategory);
    } catch (error) {
        console.error("Ошибка при создании категории:", error);
        res.status(500).json({ message: "Ошибка сервера при создании категории" });
    }
});

// DELETE /category/:id - Удалить категорию (только для авторизованных)
categoryRouter.delete("/:id", requireAuth, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const category = await getCategoryById(categoryId);
        
        if (!category) {
            return res.status(404).json({ message: "Категория не найдена" });
        }

        await deleteCategory(categoryId);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Ошибка при удалении категории:", error);
        res.status(500).json({ message: "Ошибка сервера при удалении категории" });
    }
});

module.exports = categoryRouter;