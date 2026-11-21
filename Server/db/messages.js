const { getDb } = require("./db");

const TABLE_NAME = "messages";

module.exports = {
    TABLE_NAME,

    addMessage: async (authorId, topicId, text) => {
        const result = await getDb().run(
            `INSERT INTO ${TABLE_NAME} (author_id, topic_id, text) VALUES (?, ?, ?)`,
            [authorId, topicId, text]
        );
        return { id: result.lastID, author_id: authorId, topic_id: topicId, text };
    },

    getMessagesByTopicId: async (topicId) => {
        return await getDb().all(
            `SELECT * FROM ${TABLE_NAME} WHERE topic_id = ? ORDER BY created_at ASC`, 
            [topicId]
        );
    },

    getMessageById: async (id) => {
        return await getDb().get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    },

    deleteMessage: async (id) => {
        await getDb().run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    }
};