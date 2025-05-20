import { Router } from 'express';
import { listarModulos } from '../controllers/modulos.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, listarModulos);

export default router;