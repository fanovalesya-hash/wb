const { getDb } = require("./db");
const md5 = require('md5');

const TABLE_NAME = "users";

module.exports = {
    TABLE_NAME,
    
    addUser: async (nickname, email, password, roleId = null) => {
        const hashedPassword = md5(password);
        const result = await getDb().run(
            `INSERT INTO ${TABLE_NAME} (nickname, email, password, role_id) VALUES (?, ?, ?, ?)`,
            [nickname, email, hashedPassword, roleId]
        );
        return { id: result.lastID, nickname, email, role_id: roleId };
    },

    getUsers: async () => {
        return await getDb().all(`SELECT id, nickname, email, role_id FROM ${TABLE_NAME}`);
    },

    getUserByEmail: async (email) => {
        return await getDb().get(`SELECT * FROM ${TABLE_NAME} WHERE email = ?`, [email]);
    },

    getUserById: async (id) => {
        return await getDb().get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    },

    updateUser: async (id, nickname, email, password = null) => {
        if (password) {
            const hashedPassword = md5(password);
            await getDb().run(
                `UPDATE ${TABLE_NAME} SET nickname = ?, email = ?, password = ? WHERE id = ?`,
                [nickname, email, hashedPassword, id]
            );
        } else {
            await getDb().run(
                `UPDATE ${TABLE_NAME} SET nickname = ?, email = ? WHERE id = ?`,
                [nickname, email, id]
            );
        }
    },

    deleteUser: async (id) => {
        await getDb().run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    }
};