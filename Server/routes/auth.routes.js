const { Router } = require('express');
const { handle } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const auth = require('../controllers/auth.controller');

const router = Router();

router.post('/auth/register', handle(auth.register));
router.post('/auth/login', handle(auth.login));
router.get('/auth/me', requireAuth, handle(auth.me));

module.exports = router;