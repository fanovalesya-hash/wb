const { getDb } = require("./db");

const TABLE_NAME = "topics";

module.exports = {
    TABLE_NAME,

    addTopic: async (title, description, categoryId, authorId) => {
        const result = await getDb().run(
            `INSERT INTO ${TABLE_NAME} (title, description, category_id, author_id) VALUES (?, ?, ?, ?)`,
            [title, description, categoryId, authorId]
        );
        return { id: result.lastID, title, description, category_id: categoryId, author_id: authorId };
    },

    getTopics: async () => {
        // Можно добавить JOIN с users и categories, если нужно получать имена сразу
        return await getDb().all(`SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC`);
    },

    getTopicsByCategoryId: async (categoryId) => {
        return await getDb().all(
            `SELECT * FROM ${TABLE_NAME} WHERE category_id = ? ORDER BY created_at DESC`, 
            [categoryId]
        );
    },

    getTopicById: async (id) => {
        return await getDb().get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    },

    deleteTopic: async (id) => {
        await getDb().run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    }
};