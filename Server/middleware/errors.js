const { HttpError } = require('../utils/http');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { status: 404, message: `Маршрут ${req.method} ${req.originalUrl} не найден` } });
}

function errorHandler(err, _req, res, _next) {
  // Ошибки парсинга JSON
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { status: 400, message: 'Тело запроса — некорректный JSON' } });
  }
  // Наши кастомные ошибки (400, 401, 403, 404 и т.д.)
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { status: err.status, message: err.message, details: err.details } });
  }
  // Ошибки ограничений SQLite (например, UNIQUE constraint failed)
  if (err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ error: { status: 409, message: 'Конфликт данных' } });
  }
  
  console.error(err);
  res.status(500).json({ error: { status: 500, message: 'Внутренняя ошибка сервера' } });
}

module.exports = { notFoundHandler, errorHandler };