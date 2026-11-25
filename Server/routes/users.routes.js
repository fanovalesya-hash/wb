const { Router } = require('express');
const { handle } = require('../utils/http');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const users = require('../controllers/users.controller');

const router = Router();

router.get('/users/search', handle(users.searchUsers));
router.patch('/users/me', requireAuth, handle(users.updateMe));
router.get('/users/:id', optionalAuth, handle(users.getUser));
router.get('/users/:id/posts', optionalAuth, handle(users.getUserPosts));
router.post('/users/:id/follow', requireAuth, handle(users.toggleFollow));
router.patch('/users/:id/role', requireAuth, requireRole('admin'), handle(users.setRole));

module.exports = router;