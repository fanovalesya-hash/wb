const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { getDb } = require('../db/db');
const { unauthorized, forbidden } = require('../utils/http');

// Генерируем токен при логине/регистрации
function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// Достаем юзера из БД по JWT токену
async function userFromToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const db = getDb();
    const user = await db.get('SELECT id, username, display_name, role FROM users WHERE id = ?', [payload.sub]);
    return user || null;
  } catch {
    return null; // Токен протух или невалидный
  }
}

// Не требует входа, но если кука есть — кладет юзера в req.user
async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies ? req.cookies[config.cookieName] : null;
    req.user = token ? await userFromToken(token) : null;
    next();
  } catch (err) {
    next(err);
  }
}

// Обязательно требует авторизации
async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies ? req.cookies[config.cookieName] : null;
    req.user = token ? await userFromToken(token) : null;
    if (!req.user) return next(unauthorized());
    next();
  } catch (err) {
    next(err);
  }
}

// Проверка ролей (admin, mod, user)
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

module.exports = { signToken, userFromToken, optionalAuth, requireAuth, requireRole };