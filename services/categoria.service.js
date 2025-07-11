import { pool } from '../db.js';

/**
 * Servicio para gestionar operaciones relacionadas con categorías
 */
export class CategoriaService {
  /**
   * Obtiene todas las categorías ordenadas jerárquicamente
   * @returns {Promise<Array>} Lista de categorías
   */
  static async obtenerTodasLasCategorias() {
    const [categorias] = await pool.query(`
      SELECT 
        categoria_id, 
        categoria_nombre, 
        categoria_descripcion, 
        categoria_padre_id, 
        categoria_orden 
      FROM categorias 
      ORDER BY (categoria_padre_id IS NULL) DESC, categoria_padre_id ASC, categoria_orden ASC
    `);
    
    return categorias;
  }

  /**
   * Crea una nueva categoría
   * @param {Object} datos - Datos de la categoría
   * @returns {Object} Nueva categoría creada
   */
  static async crearCategoria(datos) {
    const { categoria_nombre, categoria_descripcion, categoria_padre_id } = datos;

    // Verificar si el nombre ya existe en el mismo nivel
    const nombreDuplicado = await this.verificarNombreDuplicado(categoria_nombre, categoria_padre_id);
    if (nombreDuplicado) {
      throw new Error('Ya existe una categoría con ese nombre en el mismo nivel');
    }

    // Obtener el siguiente orden
    const [ordenRows] = await pool.query(
      'SELECT COALESCE(MAX(categoria_orden), 0) + 1 AS nuevo_orden FROM categorias WHERE categoria_padre_id <=> ?',
      [categoria_padre_id || null]
    );
    const nuevoOrden = ordenRows[0].nuevo_orden;

    const [result] = await pool.query(
      'INSERT INTO categorias (categoria_nombre, categoria_descripcion, categoria_padre_id, categoria_orden) VALUES (?, ?, ?, ?)',
      [categoria_nombre, categoria_descripcion || null, categoria_padre_id || null, nuevoOrden]
    );

    return { 
      categoria_id: result.insertId,
      categoria_padre_id: categoria_padre_id || null,
      categoria_orden: nuevoOrden
    };
  }

  /**
   * Agrega una subcategoría
   * @param {Object} datos - Datos de la subcategoría
   * @returns {Object} Nueva subcategoría creada
   */
  static async agregarSubcategoria(datos) {
    const { categoria_nombre, categoria_descripcion, categoria_padre_id } = datos;
    
    // Validar que la categoría padre exista si se proporciona
    if (categoria_padre_id) {
      const [parentExists] = await pool.query(
        'SELECT categoria_id FROM categorias WHERE categoria_id = ?', 
        [categoria_padre_id]
      );
      if (parentExists.length === 0) {
        throw new Error('La categoría padre especificada no existe.');
      }
    }

    // Verificar si el nombre ya existe en el mismo nivel
    const nombreDuplicado = await this.verificarNombreDuplicado(categoria_nombre, categoria_padre_id);
    if (nombreDuplicado) {
      throw new Error('Ya existe una categoría con ese nombre en el mismo nivel');
    }
    
    // Obtener el siguiente orden
    const [ordenRows] = await pool.query(
      'SELECT COALESCE(MAX(categoria_orden), -1) + 1 AS nuevo_orden FROM categorias WHERE categoria_padre_id <=> ?',
      [categoria_padre_id || null]
    );
    const nuevoOrden = ordenRows[0].nuevo_orden;
    
    // Insertar la nueva categoría
    const [result] = await pool.query(
      'INSERT INTO categorias (categoria_nombre, categoria_descripcion, categoria_padre_id, categoria_orden) VALUES (?, ?, ?, ?)',
      [categoria_nombre, categoria_descripcion || null, categoria_padre_id || null, nuevoOrden]
    );
    
    return {
      categoria_id: result.insertId,
      categoria_orden: nuevoOrden
    };
  }

  /**
   * Actualiza una categoría existente
   * @param {number} id - ID de la categoría
   * @param {Object} datos - Datos a actualizar
   * @returns {boolean} true si se actualizó, false si no se encontró
   */
  static async actualizarCategoria(id, datos) {
    const { categoria_nombre, categoria_descripcion, categoria_padre_id } = datos;
    
    // Verificar que la categoría existe
    const [categoriaExistente] = await pool.query(
      'SELECT categoria_id FROM categorias WHERE categoria_id = ?',
      [id]
    );

    if (categoriaExistente.length === 0) {
      return false;
    }

    // Verificar si el nombre ya existe en el mismo nivel (excluyendo la categoría actual)
    const nombreDuplicado = await this.verificarNombreDuplicado(categoria_nombre, categoria_padre_id, id);
    if (nombreDuplicado) {
      throw new Error('Ya existe una categoría con ese nombre en el mismo nivel');
    }
    
    const [result] = await pool.query(
      'UPDATE categorias SET categoria_nombre = ?, categoria_descripcion = ?, categoria_padre_id = ? WHERE categoria_id = ?',
      [categoria_nombre, categoria_descripcion || null, categoria_padre_id || null, id]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Elimina una categoría físicamente y sus subcategorías
   * @param {number} id - ID de la categoría
   * @returns {boolean} true si se eliminó, false si no se encontró
   */
  static async eliminarCategoria(id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verificar que la categoría existe
      const [categoriaExistente] = await conn.query(
        'SELECT categoria_id FROM categorias WHERE categoria_id = ?',
        [id]
      );

      if (categoriaExistente.length === 0) {
        return false;
      }

      // Eliminar primero las subcategorías (eliminación física)
      await conn.query(
        "DELETE FROM categorias WHERE categoria_padre_id = ?",
        [id]
      );

      // Eliminar la categoría principal (eliminación física)
      await conn.query(
        "DELETE FROM categorias WHERE categoria_id = ?",
        [id]
      );

      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Verifica si el nombre de categoría ya existe en el mismo nivel
   * @param {string} nombre - Nombre de la categoría
   * @param {number} padreId - ID de la categoría padre
   * @param {number} categoriaIdExcluir - ID de categoría a excluir (para actualizaciones)
   * @returns {Promise<boolean>} True si el nombre ya existe
   */
  static async verificarNombreDuplicado(nombre, padreId = null, categoriaIdExcluir = null) {
    const query = categoriaIdExcluir 
      ? 'SELECT categoria_id FROM categorias WHERE categoria_nombre = ? AND categoria_padre_id <=> ? AND categoria_id != ?'
      : 'SELECT categoria_id FROM categorias WHERE categoria_nombre = ? AND categoria_padre_id <=> ?';
    
    const params = categoriaIdExcluir 
      ? [nombre, padreId || null, categoriaIdExcluir] 
      : [nombre, padreId || null];
    
    const [resultado] = await pool.query(query, params);
    
    return resultado.length > 0;
  }
}
