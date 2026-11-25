const { getDb, tx } = require('../db/db');
const { config } = require('../config');
const { badRequest, notFound, toId, pageParams } = require('../utils/http');
const { publicUser } = require('../utils/serialize');
const { listPosts } = require('./posts.controller');

async function getUser(req) {
  const db = getDb();
  const id = toId(req.params.id);
  const me = req.user?.id ?? 0;
  
  const user = await db.get(
    `SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url, u.role, u.karma, u.created_at,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
            (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND repost_of_id IS NULL) AS posts_count,
            (SELECT COUNT(*) FROM topics WHERE author_id = u.id) AS topics_count,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = @me AND following_id = u.id) AS is_following
     FROM users u WHERE u.id = @id`,
    { id, me }
  );
  if (!user) throw notFound('Пользователь не найден');

  const topics = await db.all(
    `SELECT t.id, t.title, t.category_id, t.replies_count, t.is_pinned, t.created_at, c.name AS category_name
     FROM topics t JOIN categories c ON c.id = t.category_id
     WHERE t.author_id = ? ORDER BY t.id DESC LIMIT 20`,
    [id]
  );

  return {
    user: { ...user, is_following: !!user.is_following, is_me: me === id },
    posts: await listPosts({ me, cursor: null, limit: config.pageSize, where: 'p.author_id = @uid', params: { uid: id } }),
    topics: topics.map((t) => ({ ...t, is_pinned: !!t.is_pinned })),
  };
}

async function getUserPosts(req) {
  const id = toId(req.params.id);
  const { limit, cursor } = pageParams(req.query, config.pageSize);
  return listPosts({ me: req.user?.id ?? 0, cursor, limit, where: 'p.author_id = @uid', params: { uid: id } });
}

async function toggleFollow(req) {
  const id = toId(req.params.id);
  if (id === req.user.id) throw badRequest('Нельзя подписаться на себя');

  return await tx(async (db) => {
    const exists = await db.get('SELECT 1 FROM users WHERE id = ?', [id]);
    if (!exists) throw notFound('Пользователь не найден');

    const removed = await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, id]);
    const following = removed.changes === 0;
    if (following) await db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, id]);
    
    const { n } = await db.get('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?', [id]);
    return { user_id: id, following, followers_count: n };
  });
}

async function updateMe(req) {
  const db = getDb();
  const { display_name, bio, avatar_url } = req.body || {};
  const fields = [];
  const values = [];
  
  if (typeof display_name === 'string' && display_name.trim()) {
    fields.push('display_name = ?'); values.push(display_name.trim().slice(0, 64));
  }
  if (typeof bio === 'string') {
    fields.push('bio = ?'); values.push(bio.trim().slice(0, 300));
  }
  if (typeof avatar_url === 'string') {
    fields.push('avatar_url = ?'); values.push(avatar_url.trim() || null);
  }
  if (!fields.length) throw badRequest('Нет полей для обновления');
  
  values.push(req.user.id);
  await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  
  const updated = await db.get('SELECT id, username, display_name, bio, avatar_url, role, karma FROM users WHERE id = ?', [req.user.id]);
  return { user: updated };
}

async function searchUsers(req) {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  if (!q) return { items: [] };
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const items = await db.all(
    'SELECT id, username, display_name, avatar_url, role FROM users WHERE username LIKE ? OR display_name LIKE ? LIMIT 10',
    [like, like]
  );
  return { items: items.map((u) => publicUser(u)) };
}

async function setRole(req) {
  const db = getDb();
  const id = toId(req.params.id);
  const { role } = req.body || {};
  if (!['admin', 'mod', 'user'].includes(role)) throw badRequest('Роль: admin, mod или user');
  
  const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  if (!result.changes) throw notFound('Пользователь не найден');
  return { user_id: id, role };
}

module.exports = { getUser, getUserPosts, toggleFollow, updateMe, searchUsers, setRole };