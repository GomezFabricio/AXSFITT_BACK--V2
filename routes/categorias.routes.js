import { Router } from 'express';
import { crearCategoria, agregarSubcategoria, modificarCategoria, eliminarCategoria, reordenarCategorias, getAllCategorias } from '../controllers/categorias.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

// Obtener todas las categorías activas
router.get('/', authenticate, validarPermisos('Ver Categorias'), getAllCategorias);

// Crear una nueva categoría (padre o subcategoría si categoria_padre_id en body)
router.post('/', authenticate, validarPermisos('Agregar Categoria'), crearCategoria);

// Agregar una subcategoría asociada a una categoría padre (categoria_padre_id en URL)
router.post('/:categoria_padre_id/subcategoria', authenticate, validarPermisos('Agregar Categoria'), agregarSubcategoria);

// Modificar una categoría existente
router.put('/:categoria_id', authenticate, validarPermisos('Modificar Categoria'), modificarCategoria);

// Eliminar una categoría (baja lógica) y sus subcategorías
router.delete('/:categoria_id', authenticate, validarPermisos('Eliminar Categoria'), eliminarCategoria);

// Reordenar categorías o subcategorías
router.put('/reordenar', authenticate, validarPermisos('Modificar Categoria'), reordenarCategorias);

export default router;