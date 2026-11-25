const { Router } = require('express');
const authRoutes = require('./auth.routes');
const postsRoutes = require('./posts.routes');
const forumRoutes = require('./forum.routes');
const usersRoutes = require('./users.routes');
const messagesRoutes = require('./messages.routes');

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));


router.use(authRoutes);
router.use(postsRoutes);
router.use(forumRoutes);
router.use(usersRoutes);
router.use(messagesRoutes);

module.exports = router;