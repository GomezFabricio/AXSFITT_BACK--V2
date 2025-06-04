import { Router } from 'express';
import {
  crearCategoria,
  agregarSubcategoria,
  modificarCategoria,
  eliminarCategoria,
  reordenarCategorias,
  getAllCategorias, 
} from '../controllers/categorias.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// Get all active categories
router.get('/', authenticate, getAllCategorias);

// Crear una nueva categoría (padre o subcategoría si categoria_padre_id en body)
router.post('/', authenticate, crearCategoria);

// Agregar una subcategoría asociada a una categoría padre (categoria_padre_id en URL)
router.post('/:categoria_padre_id/subcategoria', authenticate, agregarSubcategoria);

// Modificar una categoría existente
router.put('/:categoria_id', authenticate, modificarCategoria);

// Eliminar una categoría (baja lógica) y sus subcategorías
router.delete('/:categoria_id', authenticate, eliminarCategoria);

// Reordenar categorías o subcategorías
router.put('/reordenar', authenticate, reordenarCategorias);

export default router;