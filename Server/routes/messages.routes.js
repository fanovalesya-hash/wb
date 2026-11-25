const { Router } = require('express');
const { handle } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const messages = require('../controllers/messages.controller');

const router = Router();

router.get('/conversations', requireAuth, handle(messages.listConversations));
router.get('/conversations/:userId', requireAuth, handle(messages.getConversation));
router.get('/messages/unread', requireAuth, handle(messages.unreadCount));
router.post('/messages', requireAuth, handle(messages.sendMessage));
router.post('/messages/:id/read', requireAuth, handle(messages.markRead));

module.exports = router;