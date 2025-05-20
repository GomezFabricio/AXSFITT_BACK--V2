import { Router } from 'express';
import { login } from '../controllers/login.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', login);

// Ruta para verificar el token
router.get('/verify-token', authenticate, (req, res) => {
    res.status(200).json({ message: 'Token is valid', user: req.user });
});

export default router;
