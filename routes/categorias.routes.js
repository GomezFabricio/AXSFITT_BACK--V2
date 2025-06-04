import { Router } from 'express';
import {
  crearCategoria,
  agregarSubcategoria,
  modificarCategoria,
  eliminarCategoria,
  reordenarCategorias,
} from '../controllers/categorias.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// Crear una nueva categoría
router.post('/', authenticate, crearCategoria);

// Agregar una subcategoría asociada a una categoría padre
router.post('/:categoria_padre_id/subcategoria', authenticate, agregarSubcategoria);

// Modificar una categoría existente
router.put('/:categoria_id', authenticate, modificarCategoria);

// Eliminar una categoría (baja lógica) y sus subcategorías
router.delete('/:categoria_id', authenticate, eliminarCategoria);

// Reordenar categorías o subcategorías
router.put('/reordenar', authenticate, reordenarCategorias);

export default router;