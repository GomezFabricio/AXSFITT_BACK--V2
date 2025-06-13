import { Router } from 'express';
import { 
  login, 
  solicitarRecuperacionPassword, 
  verificarTokenRecuperacion, 
  restablecerPassword 
} from '../controllers/login.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', login);

// Ruta para verificar el token
router.get('/verify-token', authenticate, (req, res) => {
    res.status(200).json({ message: 'Token is valid', user: req.user });
});

// Rutas para recuperación de contraseña
router.post('/recuperar-password', solicitarRecuperacionPassword);
router.get('/verificar-token-recuperacion/:token', verificarTokenRecuperacion);
router.post('/restablecer-password', restablecerPassword);

export default router;