const { nanoid } = require("nanoid");
const { getDb } = require("./db");

const TABLE_NAME = "tokens";

module.exports = {
    TABLE_NAME,

    getUserIdByToken: async (token) => {
        const result = await getDb().get(`SELECT userId FROM ${TABLE_NAME} WHERE token = ?`, [token]);
        return result?.userId;
    },

    deleteByToken: async (token) => {
        await getDb().run(`DELETE FROM ${TABLE_NAME} WHERE token = ?`, [token]);
    },

    deleteByUserId: async (userId) => {
        await getDb().run(`DELETE FROM ${TABLE_NAME} WHERE userId = ?`, [userId]);
    },

    addToken: async (userId) => {
        const token = nanoid();
        // Проверяем, есть ли уже токен у пользователя
        const tokenRow = await getDb().get(`SELECT id FROM ${TABLE_NAME} WHERE userId = ?`, [userId]);
        
        if (tokenRow) {
            await getDb().run(
                `UPDATE ${TABLE_NAME} SET token = ? WHERE userId = ?`,
                [token, userId]
            );
        } else {
            await getDb().run(
                `INSERT INTO ${TABLE_NAME} (token, userId) VALUES (?, ?)`,
                [token, userId]
            );
        }
        return token;
    }
};