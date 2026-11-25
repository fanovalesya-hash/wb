const { getDb, tx } = require('../db/db');
const { config } = require('../config');
const { badRequest, forbidden, notFound, toId, requireText, pageParams } = require('../utils/http');
const { publicUser, buildTree } = require('../utils/serialize');

const POST_SELECT = `
  SELECT p.*,
         u.id AS a_id, u.username AS a_username, u.display_name AS a_display_name, u.avatar_url AS a_avatar_url, u.role AS a_role,
         o.id AS o_post_id, o.text AS o_text, o.created_at AS o_created_at,
         o.likes_count AS o_likes_count, o.reposts_count AS o_reposts_count, o.comments_count AS o_comments_count,
         ou.id AS ou_id, ou.username AS ou_username, ou.display_name AS ou_display_name, ou.avatar_url AS ou_avatar_url, ou.role AS ou_role,
         EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = COALESCE(p.repost_of_id, p.id) AND l.user_id = @me) AS liked,
         EXISTS(SELECT 1 FROM posts r WHERE r.repost_of_id = COALESCE(p.repost_of_id, p.id) AND r.author_id = @me) AS reposted
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN posts o ON o.id = p.repost_of_id
  LEFT JOIN users ou ON ou.id = o.author_id`;

function serializePost(row) {
  const base = {
    id: row.id, author: publicUser(row, 'a_'), created_at: row.created_at,
    liked: !!row.liked, reposted: !!row.reposted,
  };
  if (row.repost_of_id) {
    return {
      ...base, type: 'repost',
      original: row.o_post_id ? {
        id: row.o_post_id, text: row.o_text, author: publicUser(row, 'ou_'),
        created_at: row.o_created_at, likes_count: row.o_likes_count,
        reposts_count: row.o_reposts_count, comments_count: row.o_comments_count,
      } : null,
    };
  }
  return {
    ...base, type: 'post', text: row.text,
    likes_count: row.likes_count, reposts_count: row.reposts_count, comments_count: row.comments_count,
  };
}

async function listPosts({ me, cursor, limit, where = '1 = 1', params = {} }) {
  const db = getDb();
  const rows = await db.all(
    `${POST_SELECT} WHERE ${where} ${cursor ? 'AND p.id < @cursor' : ''} ORDER BY p.id DESC LIMIT @limit`,
    { me, cursor, limit: limit + 1, ...params }
  );
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(serializePost);
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

async function getPostRow(id, me) {
  const db = getDb();
  return await db.get(`${POST_SELECT} WHERE p.id = @id`, { id, me });
}

async function feed(req) {
  const me = req.user?.id ?? 0;
  const { limit, cursor } = pageParams(req.query, config.pageSize);
  const scope = req.query.scope === 'following' && req.user ? 'following' : 'all';
  const where = scope === 'following'
      ? '(p.author_id = @me OR p.author_id IN (SELECT following_id FROM follows WHERE follower_id = @me))'
      : '1 = 1';
  return { scope, ...(await listPosts({ me, cursor, limit, where })) };
}

async function getPost(req) {
  const db = getDb();
  const id = toId(req.params.id);
  const row = await getPostRow(id, req.user?.id ?? 0);
  if (!row) throw notFound('Пост не найден');

  const targetId = row.repost_of_id || row.id;
  const commentsRows = await db.all(
    `SELECT c.id, c.parent_id, c.text, c.created_at,
            u.id AS a_id, u.username AS a_username, u.display_name AS a_display_name, u.avatar_url AS a_avatar_url, u.role AS a_role
     FROM post_comments c JOIN users u ON u.id = c.author_id
     WHERE c.post_id = ? ORDER BY c.id`,
    [targetId]
  );
  const comments = commentsRows.map((c) => ({ id: c.id, parent_id: c.parent_id, text: c.text, created_at: c.created_at, author: publicUser(c, 'a_') }));

  return { post: serializePost(row), comments: buildTree(comments) };
}

async function createPost(req, res) {
  const db = getDb();
  const text = requireText(req.body?.text, 'Текст', config.postMaxLength);
  const result = await db.run('INSERT INTO posts (author_id, text) VALUES (?, ?)', [req.user.id, text]);
  res.status(201);
  return { post: serializePost(await getPostRow(result.lastID, req.user.id)) };
}

async function toggleLike(req, res) {
  const id = toId(req.params.id);
  
  const result = await tx(async (db) => {
    const post = await db.get('SELECT id, author_id, repost_of_id FROM posts WHERE id = ?', [id]);
    if (!post) throw notFound('Пост не найден');
    const targetId = post.repost_of_id || post.id;
    const target = await db.get('SELECT id, author_id FROM posts WHERE id = ?', [targetId]);

    const removed = await db.run('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [req.user.id, targetId]);
    const liked = removed.changes === 0;
    if (liked) await db.run('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)', [req.user.id, targetId]);
    
    const delta = liked ? 1 : -1;
    await db.run('UPDATE posts SET likes_count = likes_count + ? WHERE id = ?', [delta, targetId]);
    if (target.author_id !== req.user.id) {
      await db.run('UPDATE users SET karma = karma + ? WHERE id = ?', [delta, target.author_id]);
    }
    
    const { likes_count } = await db.get('SELECT likes_count FROM posts WHERE id = ?', [targetId]);
    return { post_id: targetId, liked, likes_count };
  });

  res.status(200);
  return result;
}

async function toggleRepost(req) {
  const id = toId(req.params.id);
  
  return await tx(async (db) => {
    const post = await db.get('SELECT id, author_id, repost_of_id FROM posts WHERE id = ?', [id]);
    if (!post) throw notFound('Пост не найден');
    const targetId = post.repost_of_id || post.id;
    const target = await db.get('SELECT author_id FROM posts WHERE id = ?', [targetId]);
    if (target.author_id === req.user.id) throw badRequest('Нельзя репостнуть собственный пост');

    const removed = await db.run('DELETE FROM posts WHERE author_id = ? AND repost_of_id = ?', [req.user.id, targetId]);
    const reposted = removed.changes === 0;
    if (reposted) await db.run('INSERT INTO posts (author_id, repost_of_id) VALUES (?, ?)', [req.user.id, targetId]);
    
    await db.run('UPDATE posts SET reposts_count = reposts_count + ? WHERE id = ?', [reposted ? 1 : -1, targetId]);
    const { reposts_count } = await db.get('SELECT reposts_count FROM posts WHERE id = ?', [targetId]);
    return { post_id: targetId, reposted, reposts_count };
  });
}

async function addComment(req, res) {
  const id = toId(req.params.id);
  
  const comment = await tx(async (db) => {
    const post = await db.get('SELECT id, repost_of_id FROM posts WHERE id = ?', [id]);
    if (!post) throw notFound('Пост не найден');
    const targetId = post.repost_of_id || post.id;
    
    const text = requireText(req.body?.text, 'Комментарий', config.commentMaxLength);
    let parentId = null;
    
    if (req.body?.parent_id) {
      parentId = toId(req.body.parent_id, 'parent_id');
      const parent = await db.get('SELECT post_id FROM post_comments WHERE id = ?', [parentId]);
      if (!parent || parent.post_id !== targetId) throw badRequest('Родительский комментарий не найден');
    }

    const result = await db.run(
      'INSERT INTO post_comments (post_id, author_id, parent_id, text) VALUES (?, ?, ?, ?)',
      [targetId, req.user.id, parentId, text]
    );
    await db.run('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?', [targetId]);
    return await db.get('SELECT id, parent_id, text, created_at FROM post_comments WHERE id = ?', [result.lastID]);
  });

  res.status(201);
  return { comment: { ...comment, author: req.user, children: [] } };
}

async function deletePost(req) {
  const id = toId(req.params.id);
  
  await tx(async (db) => {
    const post = await db.get('SELECT id, author_id, repost_of_id FROM posts WHERE id = ?', [id]);
    if (!post) throw notFound('Пост не найден');
    const canModerate = ['admin', 'mod'].includes(req.user.role);
    if (post.author_id !== req.user.id && !canModerate) throw forbidden('Можно удалять только свои посты');
    
    if (post.repost_of_id) {
      await db.run('UPDATE posts SET reposts_count = reposts_count - 1 WHERE id = ?', [post.repost_of_id]);
    }
    await db.run('DELETE FROM posts WHERE id = ?', [id]);
  });
  
  return { deleted: true, id };
}

module.exports = { feed, getPost, createPost, toggleLike, toggleRepost, addComment, deletePost, listPosts };