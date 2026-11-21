const { getDb } = require("./db");

const TABLE_NAME = "categories";

module.exports = {
    TABLE_NAME,

    addCategory: async (name, description = null) => {
        const result = await getDb().run(
            `INSERT INTO ${TABLE_NAME} (name, description) VALUES (?, ?)`,
            [name, description]
        );
        return { id: result.lastID, name, description };
    },

    getCategories: async () => {
        return await getDb().all(`SELECT * FROM ${TABLE_NAME}`);
    },

    getCategoryById: async (id) => {
        return await getDb().get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    },

    deleteCategory: async (id) => {
        await getDb().run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    }
};