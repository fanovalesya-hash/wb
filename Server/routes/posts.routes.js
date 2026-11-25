const { Router } = require('express');
const { handle } = require('../utils/http');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const posts = require('../controllers/posts.controller');

const router = Router();

router.get('/feed', optionalAuth, handle(posts.feed));
router.get('/posts/:id', optionalAuth, handle(posts.getPost));
router.post('/posts', requireAuth, handle(posts.createPost));
router.delete('/posts/:id', requireAuth, handle(posts.deletePost));
router.post('/posts/:id/like', requireAuth, handle(posts.toggleLike));
router.post('/posts/:id/repost', requireAuth, handle(posts.toggleRepost));
router.post('/posts/:id/comments', requireAuth, handle(posts.addComment));

module.exports = router;