// Server/db/seed.js
const bcrypt = require('bcryptjs');
const { getDb, tx } = require('./db');

async function seedIfEmpty() {
  const db = getDb();
  const { n } = await db.get('SELECT COUNT(*) AS n FROM users');
  if (n > 0) return false;

  const hash = bcrypt.hashSync('password123', 10);

  await tx(async (db) => {
    const addUser = await db.prepare(
      `INSERT INTO users (username, email, password_hash, display_name, bio, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    // sqlite-пакет не поддерживает .prepare().run() таким же образом,
    // поэтому через run с параметрами:
    const admin = (await db.run(
      `INSERT INTO users (username, email, password_hash, display_name, bio, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin', 'admin@example.com', hash, 'Администратор', 'Слежу за порядком.', 'admin']
    )).lastID;
    const anna = (await db.run(
      `INSERT INTO users (username, email, password_hash, display_name, bio, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['anna', 'anna@example.com', hash, 'Анна Петрова', 'Фронтенд, кофе и котики.', 'mod']
    )).lastID;
    const ivan = (await db.run(
      `INSERT INTO users (username, email, password_hash, display_name, bio, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['ivan', 'ivan@example.com', hash, 'Иван Смирнов', 'Пишу бэкенд на Node.js.', 'user']
    )).lastID;

    const general = (await db.run(
      'INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, ?)',
      ['Общее', 'general', 'Разговоры обо всём', 1]
    )).lastID;
    const dev = (await db.run(
      'INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, ?)',
      ['Разработка', 'dev', 'Код, архитектура, инструменты', 2]
    )).lastID;
    await db.run(
      'INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, ?)',
      ['Оффтоп', 'offtopic', 'Всё, что не подошло в другие разделы', 3]
    );

    const texts = [
      [ivan, 'Перевёл проект на SQLite — запуск за секунду, никаких контейнеров.'],
      [anna, 'Тёмная тема на CSS-переменных — 20 строк кода. Почему я не сделала это раньше?'],
      [admin, 'Добро пожаловать на Твиттер-Форум! Правила — в разделе «Общее».'],
    ];
    for (let i = 0; i < 30; i++) {
      const [author, text] = texts[i % texts.length];
      await db.run('INSERT INTO posts (author_id, text) VALUES (?, ?)', [author, `${text} #${i + 1}`]);
    }

    const rules = (await db.run(
      'INSERT INTO topics (category_id, author_id, title, body, is_pinned) VALUES (?, ?, ?, ?, ?)',
      [general, admin, 'Правила форума', 'Будьте вежливы. Без спама. Модераторы могут закрепить или закрыть тему.', 1]
    )).lastID;
    const orm = (await db.run(
      'INSERT INTO topics (category_id, author_id, title, body, is_pinned) VALUES (?, ?, ?, ?, ?)',
      [dev, ivan, 'ORM или чистый SQL?', 'Что вы используете в своих проектах и почему?', 0]
    )).lastID;

    const r1 = (await db.run(
      'INSERT INTO topic_replies (topic_id, author_id, parent_id, body) VALUES (?, ?, ?, ?)',
      [orm, anna, null, 'Для маленьких проектов — чистый SQL, он прозрачнее.']
    )).lastID;
    await db.run(
      'INSERT INTO topic_replies (topic_id, author_id, parent_id, body) VALUES (?, ?, ?, ?)',
      [orm, ivan, r1, 'Согласен, а миграции пишу руками.']
    );
    await db.run(
      'INSERT INTO topic_replies (topic_id, author_id, parent_id, body) VALUES (?, ?, ?, ?)',
      [rules, anna, null, 'Принято!']
    );
    await db.run('UPDATE topics SET replies_count = (SELECT COUNT(*) FROM topic_replies WHERE topic_id = topics.id)');

    await db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [ivan, anna]);

    const conv = (await db.run(
      'INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?)',
      [anna, ivan]
    )).lastID;
    const msg = (await db.run(
      'INSERT INTO messages (conversation_id, sender_id, recipient_id, text) VALUES (?, ?, ?, ?)',
      [conv, anna, ivan, 'Привет! Посмотришь мой PR?']
    )).lastID;
    await db.run(
      `UPDATE conversations
       SET last_message_id = ?, last_message_at = (SELECT created_at FROM messages WHERE id = ?)
       WHERE id = ?`,
      [msg, msg, conv]
    );
  });

  return true;
}

module.exports = { seedIfEmpty };

// Запуск напрямую: node db/seed.js
if (require.main === module) {
  (async () => {
    const { initDb } = require('./db');
    await initDb();
    const ok = await seedIfEmpty();
    console.log(ok ? 'Демо-данные добавлены' : 'База уже заполнена, пропускаю');
    process.exit(0);
  })();
}