const { Router } = require('express');
const { handle } = require('../utils/http');
const { requireAuth, requireRole } = require('../middleware/auth');
const forum = require('../controllers/forum.controller');

const router = Router();

router.get('/categories', handle(forum.listCategories));
router.post('/categories', requireAuth, requireRole('admin'), handle(forum.createCategory));
router.get('/categories/:id/topics', handle(forum.listTopics));
router.get('/topics/:id', handle(forum.getTopic));
router.post('/topics', requireAuth, handle(forum.createTopic));
router.post('/topics/:id/replies', requireAuth, handle(forum.createReply));
router.patch('/topics/:id', requireAuth, requireRole('admin', 'mod'), handle(forum.setTopicFlags));

module.exports = router;