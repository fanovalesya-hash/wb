const bcrypt = require('bcryptjs');
const { getDb } = require('../db/db');
const { config } = require('../config');
const { signToken } = require('../middleware/auth');
const { badRequest, conflict, unauthorized, requireText } = require('../utils/http');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  const { username, email, password, display_name } = req.body || {};
  if (!USERNAME_RE.test(username || '')) {
    throw badRequest('Логин: 3–32 символа, латиница, цифры и _', { field: 'username' });
  }
  if (!EMAIL_RE.test(email || '')) throw badRequest('Некорректный email', { field: 'email' });
  if (typeof password !== 'string' || password.length < 6) {
    throw badRequest('Пароль должен быть не короче 6 символов', { field: 'password' });
  }
  const name = display_name ? requireText(display_name, 'Имя', 64) : username;

  const db = getDb();
  const exists = await db.get('SELECT 1 FROM users WHERE username = ? OR email = ?', [username, email]);
  if (exists) throw conflict('Логин или email уже заняты');

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.run(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [username, email, hash, name]
  );

  const user = await db.get(
    'SELECT id, username, email, display_name, bio, avatar_url, role, karma, created_at FROM users WHERE id = ?',
    [result.lastID]
  );
  
  // Устанавливаем httpOnly куку
  const token = signToken(user);
  res.cookie(config.cookieName, token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  
  res.status(201);
  return { user };
}

async function login(req, res) {
  const { login, password } = req.body || {};
  if (!login || !password) throw badRequest('Укажите логин (или email) и пароль');

  const db = getDb();
  const row = await db.get('SELECT id, password_hash FROM users WHERE username = ? OR email = ?', [login, login]);
  
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw unauthorized('Неверный логин или пароль');
  }
  
  const user = await db.get(
    'SELECT id, username, email, display_name, bio, avatar_url, role, karma, created_at FROM users WHERE id = ?',
    [row.id]
  );

  // Устанавливаем httpOnly куку
  const token = signToken(user);
  res.cookie(config.cookieName, token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });

  return { user };
}

async function me(req) {
  const db = getDb();
  const user = await db.get(
    'SELECT id, username, email, display_name, bio, avatar_url, role, karma, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  const { unread } = await db.get('SELECT COUNT(*) AS unread FROM messages WHERE recipient_id = ? AND read_at IS NULL', [req.user.id]);
  return { user, unread_messages: unread };
}

module.exports = { register, login, me };