class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Требуется авторизация') => new HttpError(401, msg);
const forbidden = (msg = 'Недостаточно прав') => new HttpError(403, msg);
const notFound = (msg = 'Не найдено') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

// Обёртка для контроллеров (ловит ошибки async/await)
const handle = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req, res);
    if (result !== undefined && !res.headersSent) res.json(result);
  } catch (err) {
    next(err);
  }
};

function toId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Некорректный ${name}`);
  return n;
}

function requireText(value, field, max, min = 1) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) throw badRequest(`Поле «${field}» обязательно`, { field });
  if (text.length > max) throw badRequest(`Поле «${field}» длиннее ${max} символов`, { field, max });
  return text;
}

function pageParams(query, defaultLimit = 20) {
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), 100);
  const cursor = query.cursor ? toId(query.cursor, 'cursor') : null;
  return { limit, cursor };
}

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, handle, toId, requireText, pageParams };