const { getDb, tx } = require('../db/db');
const { config } = require('../config');
const { badRequest, forbidden, notFound, toId, requireText, pageParams } = require('../utils/http');
const { publicUser, buildTree } = require('../utils/serialize');

const AUTHOR_COLS = `u.id AS a_id, u.username AS a_username, u.display_name AS a_display_name, u.avatar_url AS a_avatar_url, u.role AS a_role`;

function serializeTopic(t) {
  return {
    id: t.id, category_id: t.category_id, title: t.title, body: t.body,
    is_pinned: !!t.is_pinned, is_locked: !!t.is_locked, replies_count: t.replies_count,
    created_at: t.created_at, last_activity_at: t.last_activity_at,
    author: publicUser(t, 'a_'),
  };
}

async function listCategories() {
  const db = getDb();
  const items = await db.all(
    `SELECT c.*,
            (SELECT COUNT(*) FROM topics t WHERE t.category_id = c.id) AS topics_count,
            (SELECT MAX(last_activity_at) FROM topics t WHERE t.category_id = c.id) AS last_activity_at
     FROM categories c ORDER BY c.position, c.id`
  );
  return { items };
}

async function listTopics(req) {
  const db = getDb();
  const categoryId = toId(req.params.id);
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);
  if (!category) throw notFound('Категория не найдена');

  const { limit } = pageParams(req.query, 30);
  const page = Math.max(Number(req.query.page) || 1, 1);
  
  const rows = await db.all(
    `SELECT t.*, ${AUTHOR_COLS} FROM topics t JOIN users u ON u.id = t.author_id
     WHERE t.category_id = ? ORDER BY t.is_pinned DESC, t.last_activity_at DESC LIMIT ? OFFSET ?`,
    [categoryId, limit, (page - 1) * limit]
  );
  const items = rows.map(serializeTopic);
  const { total } = await db.get('SELECT COUNT(*) AS total FROM topics WHERE category_id = ?', [categoryId]);

  return { category, items, page, total, pages: Math.max(Math.ceil(total / limit), 1) };
}

async function getTopic(req) {
  const db = getDb();
  const id = toId(req.params.id);
  const row = await db.get(`SELECT t.*, ${AUTHOR_COLS} FROM topics t JOIN users u ON u.id = t.author_id WHERE t.id = ?`, [id]);
  if (!row) throw notFound('Тема не найдена');
  
  const category = await db.get('SELECT id, name, slug FROM categories WHERE id = ?', [row.category_id]);
  const repliesRows = await db.all(
    `SELECT r.id, r.parent_id, r.body, r.created_at, ${AUTHOR_COLS}
     FROM topic_replies r JOIN users u ON u.id = r.author_id WHERE r.topic_id = ? ORDER BY r.id`,
    [id]
  );
  
  const replies = repliesRows.map((r) => ({ id: r.id, parent_id: r.parent_id, body: r.body, created_at: r.created_at, author: publicUser(r, 'a_') }));
  return { topic: serializeTopic(row), category, replies: buildTree(replies) };
}

async function createTopic(req, res) {
  const db = getDb();
  const categoryId = toId(req.body?.category_id, 'category_id');
  const catExists = await db.get('SELECT 1 FROM categories WHERE id = ?', [categoryId]);
  if (!catExists) throw notFound('Категория не найдена');
  
  const title = requireText(req.body?.title, 'Заголовок', config.topicTitleMaxLength, 3);
  const body = requireText(req.body?.body, 'Текст', config.replyMaxLength);
  const pin = req.body?.is_pinned && ['admin', 'mod'].includes(req.user.role) ? 1 : 0;

  const result = await db.run(
    'INSERT INTO topics (category_id, author_id, title, body, is_pinned) VALUES (?, ?, ?, ?, ?)',
    [categoryId, req.user.id, title, body, pin]
  );
  
  res.status(201);
  return getTopic({ params: { id: result.lastID } });
}

async function createReply(req, res) {
  const topicId = toId(req.params.id);
  
  const topic = await tx(async (db) => {
    const t = await db.get('SELECT id, author_id, is_locked FROM topics WHERE id = ?', [topicId]);
    if (!t) throw notFound('Тема не найдена');
    if (t.is_locked && !['admin', 'mod'].includes(req.user.role)) throw forbidden('Тема закрыта для ответов');
    
    const body = requireText(req.body?.body, 'Ответ', config.replyMaxLength);
    let parentId = null;
    
    if (req.body?.parent_id) {
      parentId = toId(req.body.parent_id, 'parent_id');
      const parent = await db.get('SELECT topic_id FROM topic_replies WHERE id = ?', [parentId]);
      if (!parent || parent.topic_id !== topicId) throw badRequest('Родительский ответ не найден в этой теме');
    }

    const result = await db.run(
      'INSERT INTO topic_replies (topic_id, author_id, parent_id, body) VALUES (?, ?, ?, ?)',
      [topicId, req.user.id, parentId, body]
    );
    
    await db.run(
      `UPDATE topics SET replies_count = replies_count + 1, last_activity_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      [topicId]
    );
    if (t.author_id !== req.user.id) {
      await db.run('UPDATE users SET karma = karma + 1 WHERE id = ?', [t.author_id]);
    }
    return await db.get('SELECT id, parent_id, body, created_at FROM topic_replies WHERE id = ?', [result.lastID]);
  });

  res.status(201);
  return { reply: { ...topic, author: req.user, children: [] } };
}

async function setTopicFlags(req) {
  const db = getDb();
  const id = toId(req.params.id);
  const exists = await db.get('SELECT 1 FROM topics WHERE id = ?', [id]);
  if (!exists) throw notFound('Тема не найдена');
  
  const { is_pinned, is_locked } = req.body || {};
  if (typeof is_pinned === 'boolean') await db.run('UPDATE topics SET is_pinned = ? WHERE id = ?', [+is_pinned, id]);
  if (typeof is_locked === 'boolean') await db.run('UPDATE topics SET is_locked = ? WHERE id = ?', [+is_locked, id]);
  
  return getTopic({ params: { id } });
}

async function createCategory(req, res) {
  const db = getDb();
  const name = requireText(req.body?.name, 'Название', 64);
  const slug = requireText(req.body?.slug, 'Slug', 64).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw badRequest('Slug: латиница, цифры и дефис');
  
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : '';
  const position = Number(req.body?.position) || 0;
  
  const result = await db.run(
    'INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, ?)',
    [name, slug, description, position]
  );
  
  res.status(201);
  return { category: await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]) };
}

module.exports = { listCategories, listTopics, getTopic, createTopic, createReply, setTopicFlags, createCategory };