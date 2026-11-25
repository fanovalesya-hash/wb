const path = require('path');

const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: '7d',
  cookieName: 'token',
  dbFile: path.resolve(__dirname, 'database.db'),
  postMaxLength: Number(process.env.POST_MAX_LENGTH) || 280,
  commentMaxLength: 1000,
  topicTitleMaxLength: 200,
  replyMaxLength: 10000,
  messageMaxLength: 4000,
  pageSize: 20,
};

module.exports = { config };