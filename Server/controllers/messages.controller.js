const { getDb, tx } = require('../db/db');
const { config } = require('../config');
const { badRequest, forbidden, notFound, toId, requireText } = require('../utils/http');
const { publicUser } = require('../utils/serialize');

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

async function findConversation(db, me, other) {
  const [a, b] = pair(me, other);
  return await db.get('SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?', [a, b]);
}

function serializeMessage(m) {
  return {
    id: m.id, conversation_id: m.conversation_id, sender_id: m.sender_id,
    recipient_id: m.recipient_id, text: m.text, read_at: m.read_at,
    is_read: !!m.read_at, created_at: m.created_at,
  };
}

async function listConversations(req) {
  const db = getDb();
  const me = req.user.id;
  
  const rows = await db.all(
    `SELECT c.id, c.last_message_at,
            u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.role AS u_role,
            m.id AS m_id, m.text AS m_text, m.sender_id AS m_sender_id, m.read_at AS m_read_at, m.created_at AS m_created_at,
            (SELECT COUNT(*) FROM messages x WHERE x.conversation_id = c.id AND x.recipient_id = @me AND x.read_at IS NULL) AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user_a_id = @me THEN c.user_b_id ELSE c.user_a_id END
     LEFT JOIN messages m ON m.id = c.last_message_id
     WHERE c.user_a_id = @me OR c.user_b_id = @me
     ORDER BY c.last_message_at DESC`,
    { me }
  );

  const items = rows.map((r) => ({
    id: r.id, user: publicUser(r, 'u_'), unread_count: r.unread_count,
    last_message: r.m_id ? { id: r.m_id, text: r.m_text, sender_id: r.m_sender_id, is_read: !!r.m_read_at, created_at: r.m_created_at } : null,
  }));
  return { items, total_unread: items.reduce((s, c) => s + c.unread_count, 0) };
}

async function getConversation(req) {
  const db = getDb();
  const me = req.user.id;
  const otherId = toId(req.params.userId, 'userId');
  
  const other = await db.get('SELECT id, username, display_name, avatar_url, role FROM users WHERE id = ?', [otherId]);
  if (!other) throw notFound('Пользователь не найден');

  const conv = await findConversation(db, me, otherId);
  if (!conv) return { conversation_id: null, user: publicUser(other), messages: [], has_more: false };

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  let messages, hasMore = false;
  
  if (req.query.after) {
    messages = await db.all('SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT ?', [conv.id, toId(req.query.after, 'after'), limit]);
  } else {
    const before = req.query.before ? toId(req.query.before, 'before') : Number.MAX_SAFE_INTEGER;
    const rows = await db.all('SELECT * FROM messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?', [conv.id, before, limit + 1]);
    hasMore = rows.length > limit;
    messages = rows.slice(0, limit).reverse();
  }

  return { conversation_id: conv.id, user: publicUser(other), messages: messages.map(serializeMessage), has_more: hasMore };
}

async function sendMessage(req, res) {
  const me = req.user.id;
  const recipientId = toId(req.body?.recipient_id, 'recipient_id');
  if (recipientId === me) throw badRequest('Нельзя написать самому себе');

  const message = await tx(async (db) => {
    const userExists = await db.get('SELECT 1 FROM users WHERE id = ?', [recipientId]);
    if (!userExists) throw notFound('Получатель не найден');
    
    const text = requireText(req.body?.text, 'Сообщение', config.messageMaxLength);

    let conv = await findConversation(db, me, recipientId);
    if (!conv) {
      const [a, b] = pair(me, recipientId);
      const result = await db.run('INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?)', [a, b]);
      conv = { id: result.lastID };
    }
    
    const result = await db.run(
      'INSERT INTO messages (conversation_id, sender_id, recipient_id, text) VALUES (?, ?, ?, ?)',
      [conv.id, me, recipientId, text]
    );
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [result.lastID]);
    await db.run('UPDATE conversations SET last_message_id = ?, last_message_at = ? WHERE id = ?', [msg.id, msg.created_at, conv.id]);
    return serializeMessage(msg);
  });

  res.status(201);
  return { message };
}

async function markRead(req) {
  const db = getDb();
  const me = req.user.id;
  const id = toId(req.params.id);
  
  const msg = await db.get('SELECT * FROM messages WHERE id = ?', [id]);
  if (!msg) throw notFound('Сообщение не найдено');
  if (msg.recipient_id !== me) throw forbidden('Можно отметить только входящее сообщение');

  const { changes } = await db.run(
    `UPDATE messages SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE conversation_id = ? AND recipient_id = ? AND id <= ? AND read_at IS NULL`,
    [msg.conversation_id, me, id]
  );

  return { marked: changes, up_to_id: id };
}

async function unreadCount(req) {
  const db = getDb();
  const { n } = await db.get('SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read_at IS NULL', [req.user.id]);
  return { unread: n };
}

module.exports = { listConversations, getConversation, sendMessage, markRead, unreadCount };