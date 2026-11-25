// Server/db/db.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { config } = require('../config');

let db;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  display_name  TEXT    NOT NULL,
  bio           TEXT    NOT NULL DEFAULT '',
  avatar_url    TEXT,
  role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'mod', 'user')),
  karma         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text           TEXT    NOT NULL DEFAULT '',
  repost_of_id   INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  likes_count    INTEGER NOT NULL DEFAULT 0,
  reposts_count  INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_repost ON posts(author_id, repost_of_id) WHERE repost_of_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS post_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, id);

CREATE TABLE IF NOT EXISTS post_likes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON post_likes(post_id);

CREATE TABLE IF NOT EXISTS follows (
  follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  description TEXT    NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id      INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  author_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL,
  body             TEXT    NOT NULL,
  is_pinned        INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  is_locked        INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  replies_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_activity_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category_id, is_pinned DESC, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_author ON topics(author_id, id DESC);

CREATE TABLE IF NOT EXISTS topic_replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id   INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES topic_replies(id) ON DELETE CASCADE,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_replies_topic ON topic_replies(topic_id, id);

CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_id INTEGER,
  last_message_at TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_a ON conversations(user_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_b ON conversations(user_b_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT    NOT NULL,
  read_at         TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, conversation_id) WHERE read_at IS NULL;
`;

const initDb = async () => {
  if (!db) {
    db = await open({ filename: config.dbFile, driver: sqlite3.Database });
    await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec(SCHEMA);
  }
  return db;
};

const getDb = () => db;

// Async-транзакция поверх sqlite. Внутри fn() можно await-ить запросы через getDb().
const tx = async (fn) => {
  const database = getDb();
  await database.run('BEGIN');
  try {
    const result = await fn(database);
    await database.run('COMMIT');
    return result;
  } catch (err) {
    await database.run('ROLLBACK');
    throw err;
  }
};

module.exports = { initDb, getDb, tx };