import { Router } from 'express';
import { listarPerfiles } from '../controllers/perfiles.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, listarPerfiles);

export default router;