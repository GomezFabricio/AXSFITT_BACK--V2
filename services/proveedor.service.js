import { pool } from '../db.js';

/**
 * Servicio para gestionar operaciones relacionadas con proveedores
 * Métodos: obtenerProveedores, obtenerProveedorPorId, crearProveedor, actualizarProveedor, eliminarProveedor
 */

class ProveedorService {
  // ==================== QUERIES ESTÁTICAS ====================
  static QUERIES = {
    OBTENER_PROVEEDORES: `
      SELECT 
        proveedor_id,
        proveedor_nombre,
        proveedor_contacto,
        proveedor_email,
        proveedor_telefono,
        proveedor_direccion,
        proveedor_cuit,
        proveedor_estado,
        proveedor_fecha_registro
      FROM proveedores
      ORDER BY proveedor_nombre ASC
    `,
    OBTENER_PROVEEDOR_POR_ID: 'SELECT * FROM proveedores WHERE proveedor_id = ?',
    CREAR_PROVEEDOR: `INSERT INTO proveedores 
      (proveedor_nombre, proveedor_contacto, proveedor_email, proveedor_telefono, proveedor_direccion, proveedor_cuit, proveedor_estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ACTUALIZAR_PROVEEDOR: (campos) => `UPDATE proveedores SET ${campos.join(', ')} WHERE proveedor_id = ?`,
    ELIMINAR_PROVEEDOR: `UPDATE proveedores SET proveedor_estado = 'inactivo' WHERE proveedor_id = ?`,
  };

  /**
   * Obtiene todos los proveedores activos
   * @returns {Promise<Array>} Lista de proveedores
   */
  async obtenerProveedores() {
    const [proveedores] = await pool.query(ProveedorService.QUERIES.OBTENER_PROVEEDORES);
    return proveedores;
  }

  /**
   * Obtiene un proveedor por su ID
   * @param {number} id - ID del proveedor
   * @returns {Promise<Object|null>} Proveedor o null si no existe
   */
  async obtenerProveedorPorId(id) {
    const [rows] = await pool.query(
      ProveedorService.QUERIES.OBTENER_PROVEEDOR_POR_ID,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Crea un nuevo proveedor
   * @param {Object} data - Datos del proveedor
   * @returns {Promise<Object>} Proveedor creado
   */
  async crearProveedor(data) {
    const {
      proveedor_nombre,
      proveedor_contacto,
      proveedor_email,
      proveedor_telefono,
      proveedor_direccion,
      proveedor_cuit,
      proveedor_estado = 'activo',
    } = data;
    const [result] = await pool.query(
      ProveedorService.QUERIES.CREAR_PROVEEDOR,
      [proveedor_nombre, proveedor_contacto, proveedor_email, proveedor_telefono, proveedor_direccion, proveedor_cuit, proveedor_estado]
    );
    return { proveedor_id: result.insertId, ...data };
  }

  /**
   * Actualiza un proveedor existente
   * @param {number} id - ID del proveedor
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<boolean>} True si se actualizó
   */
  async actualizarProveedor(id, data) {
    const campos = [];
    const valores = [];
    for (const key of [
      'proveedor_nombre',
      'proveedor_contacto',
      'proveedor_email',
      'proveedor_telefono',
      'proveedor_direccion',
      'proveedor_cuit',
      'proveedor_estado',
    ]) {
      if (data[key] !== undefined) {
        campos.push(`${key} = ?`);
        valores.push(data[key]);
      }
    }
    if (!campos.length) return false;
    valores.push(id);
    const [result] = await pool.query(
      ProveedorService.QUERIES.ACTUALIZAR_PROVEEDOR(campos),
      valores
    );
    return result.affectedRows > 0;
  }

  /**
   * Elimina un proveedor (borrado lógico: cambia estado a 'inactivo')
   * @param {number} id - ID del proveedor
   * @returns {Promise<boolean>} True si se actualizó
   */
  async eliminarProveedor(id) {
    const [result] = await pool.query(
      ProveedorService.QUERIES.ELIMINAR_PROVEEDOR,
      [id]
    );
    return result.affectedRows > 0;
  }
}

export default new ProveedorService();
