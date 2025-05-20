import { Router } from 'express';
import { listarUsuarios } from '../controllers/usuarios.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, listarUsuarios);

export default router;