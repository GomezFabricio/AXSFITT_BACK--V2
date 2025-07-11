import { CategoriaService } from '../services/categoria.service.js';
import { Validador } from '../utils/validador.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Controlador refactorizado para el módulo de categorías
 * Mantiene exactamente las mismas funcionalidades que el controlador original
 */
export class CategoriaController {
  /**
   * Obtiene todas las categorías activas
   * @param {Object} req - Objeto request de Express
   * @param {Object} res - Objeto response de Express
   */
  static async getAllCategorias(req, res) {
    try {
      const categorias = await CategoriaService.obtenerTodasLasCategorias();
      res.status(200).json(categorias);
    } catch (error) {
      console.error('Error al obtener todas las categorías:', error);
      res.status(500).json({ message: 'Error interno al obtener categorías.' });
    }
  }

  /**
   * Crea una nueva categoría o subcategoría
   * @param {Object} req - Objeto request de Express
   * @param {Object} res - Objeto response de Express
   */
  static async crearCategoria(req, res) {
    const { categoria_nombre, categoria_descripcion, categoria_padre_id } = req.body;

    if (!categoria_nombre) {
      return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
    }

    try {
      const nuevaCategoria = await CategoriaService.crearCategoria({
        categoria_nombre,
        categoria_descripcion,
        categoria_padre_id
      });

      res.status(201).json({
        message: 'Categoría creada exitosamente.',
        categoria_id: nuevaCategoria.categoria_id,
      });
    } catch (error) {
      console.error('Error al crear categoría:', error);
      res.status(500).json({ message: 'Error interno al crear la categoría.' });
    }
  }

  /**
   * Agrega una subcategoría (usa el mismo mecanismo que crearCategoria)
   * @param {Object} req - Objeto request de Express
   * @param {Object} res - Objeto response de Express
   */
  static async agregarSubcategoria(req, res) {
    const { categoria_padre_id: padreIdFromParams } = req.params;
    const { categoria_nombre, categoria_descripcion, categoria_padre_id: padreIdFromBody } = req.body;
    const finalCategoriaPadreId = padreIdFromParams || padreIdFromBody;

    if (!categoria_nombre) {
      return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
    }

    try {
      const nuevaCategoria = await CategoriaService.agregarSubcategoria({
        categoria_nombre,
        categoria_descripcion,
        categoria_padre_id: finalCategoriaPadreId
      });

      res.status(201).json({
        message: 'Categoría creada exitosamente.',
        categoria_id: nuevaCategoria.categoria_id,
        categoria_padre_id: finalCategoriaPadreId || null,
        categoria_orden: nuevaCategoria.categoria_orden
      });
    } catch (error) {
      console.error('Error al crear/agregar categoría:', error);
      res.status(500).json({ message: 'Error interno al crear/agregar la categoría.' });
    }
  }

  /**
   * Modifica una categoría existente
   * @param {Object} req - Objeto request de Express
   * @param {Object} res - Objeto response de Express
   */
  static async modificarCategoria(req, res) {
    const { categoria_id } = req.params;
    const { categoria_nombre, categoria_descripcion, categoria_padre_id } = req.body;

    if (!categoria_nombre) {
      return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
    }

    try {
      const resultado = await CategoriaService.actualizarCategoria(categoria_id, {
        categoria_nombre,
        categoria_descripcion,
        categoria_padre_id
      });

      if (!resultado) {
        return res.status(404).json({ message: 'Categoría no encontrada.' });
      }

      res.status(200).json({ message: 'Categoría modificada exitosamente.' });
    } catch (error) {
      console.error('Error al modificar categoría:', error);
      
      // Manejar error de nombre duplicado
      if (error.message === 'Ya existe una categoría con ese nombre en el mismo nivel') {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Error interno al modificar la categoría.' });
    }
  }

  /**
   * Elimina una categoría (baja lógica) y sus subcategorías
   * @param {Object} req - Objeto request de Express
   * @param {Object} res - Objeto response de Express
   */
  static async eliminarCategoria(req, res) {
    const { categoria_id } = req.params;

    try {
      const resultado = await CategoriaService.eliminarCategoria(categoria_id);

      if (!resultado) {
        return res.status(404).json({ message: 'Categoría no encontrada.' });
      }

      res.status(200).json({ message: 'Categoría y sus subcategorías inactivadas exitosamente.' });
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      res.status(500).json({ message: 'Error interno al eliminar la categoría.' });
    }
  }

}
