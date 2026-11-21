const { getDb } = require("./db");

const TABLE_NAME = "roles";

module.exports = {
    TABLE_NAME,

    addRole: async (name) => {
        const result = await getDb().run(
            `INSERT INTO ${TABLE_NAME} (name) VALUES (?)`,
            [name]
        );
        return { id: result.lastID, name };
    },

    getRoles: async () => {
        return await getDb().all(`SELECT * FROM ${TABLE_NAME}`);
    },

    getRoleById: async (id) => {
        return await getDb().get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    }
};