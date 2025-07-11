import { Router } from 'express';
import { CategoriaController } from '../controllers/categorias.controller.refactorizado.js';
import authenticate from '../middlewares/auth.middleware.js';
import validarPermisos from '../middlewares/validarPermiso.js';

const router = Router();

/**
 * Rutas refactorizadas para el módulo de categorías
 * Mantiene exactamente las mismas funcionalidades que las rutas originales
 */

// Obtener todas las categorías activas
router.get('/', authenticate, CategoriaController.getAllCategorias);

// Crear una nueva categoría (padre o subcategoría si categoria_padre_id en body)
router.post('/', authenticate, validarPermisos('Agregar Categoria'), CategoriaController.crearCategoria);

// Agregar una subcategoría asociada a una categoría padre (categoria_padre_id en URL)
router.post('/:categoria_padre_id/subcategoria', authenticate, validarPermisos('Agregar Categoria'), CategoriaController.agregarSubcategoria);

// Modificar una categoría existente
router.put('/:categoria_id', authenticate, validarPermisos('Modificar Categoria'), CategoriaController.modificarCategoria);

// Eliminar una categoría (baja lógica) y sus subcategorías
router.delete('/:categoria_id', authenticate, validarPermisos('Eliminar Categoria'), CategoriaController.eliminarCategoria);

export default router;
