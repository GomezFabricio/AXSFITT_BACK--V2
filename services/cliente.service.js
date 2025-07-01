import { pool } from '../db.js';

/**
 * Servicio para gestionar operaciones relacionadas con clientes
 */
export class ClienteService {
  /**
   * Verifica si un email ya existe en la base de datos
   * @param {string} email - Email a verificar
   * @param {number} clienteIdExcluir - ID del cliente a excluir de la búsqueda (para actualizaciones)
   * @returns {Promise<boolean>} True si el email ya existe
   */
  static async verificarEmailExistente(email, clienteIdExcluir = null) {
    const query = clienteIdExcluir 
      ? 'SELECT cliente_id FROM clientes WHERE cliente_email = ? AND cliente_id != ? AND cliente_fecha_baja IS NULL'
      : 'SELECT cliente_id FROM clientes WHERE cliente_email = ? AND cliente_fecha_baja IS NULL';
    
    const params = clienteIdExcluir ? [email, clienteIdExcluir] : [email];
    const [resultado] = await pool.query(query, params);
    
    return resultado.length > 0;
  }

  /**
   * Obtiene todos los clientes activos
   * @returns {Promise<Array>} Lista de clientes
   */
  static async obtenerTodos() {
    const [clientes] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_email,
        c.cliente_fecha_alta
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_fecha_baja IS NULL
      ORDER BY p.persona_apellido, p.persona_nombre
    `);
    
    return clientes;
  }

  /**
   * Obtiene un cliente por su ID
   * @param {number} id - ID del cliente
   * @returns {Promise<Object|null>} Datos del cliente o null si no existe
   */
  static async obtenerPorId(id) {
    const [cliente] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_email,
        c.cliente_fecha_alta
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_id = ? AND c.cliente_fecha_baja IS NULL
    `, [id]);
    
    return cliente.length > 0 ? cliente[0] : null;
  }

  /**
   * Crea un nuevo cliente
   * @param {Object} clienteData - Datos del cliente a crear
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async crear(clienteData) {
    const { 
      persona_nombre, 
      persona_apellido, 
      persona_dni, 
      persona_fecha_nac, 
      persona_domicilio,
      persona_telefono,
      cliente_email
    } = clienteData;
    
    // Verificar si el email ya existe
    const emailExiste = await this.verificarEmailExistente(cliente_email);
    if (emailExiste) {
      const error = new Error('Ya existe un cliente con ese email');
      error.code = 'EMAIL_DUPLICADO';
      throw error;
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 1. Insertar la persona
      const [personaResult] = await conn.query(
        `INSERT INTO personas (
          persona_nombre, 
          persona_apellido, 
          persona_dni, 
          persona_fecha_nac, 
          persona_domicilio,
          persona_telefono,
          persona_fecha_alta
        ) VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
        [
          persona_nombre,
          persona_apellido,
          persona_dni,
          persona_fecha_nac || null,
          persona_domicilio || null,
          persona_telefono
        ]
      );
      
      const persona_id = personaResult.insertId;
      
      // 2. Crear el cliente asociado a la persona
      const [clienteResult] = await conn.query(
        `INSERT INTO clientes (
          persona_id,
          cliente_email,
          cliente_fecha_alta
        ) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [
          persona_id,
          cliente_email
        ]
      );
      
      await conn.commit();
      
      return { 
        cliente_id: clienteResult.insertId,
        persona_id
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualiza un cliente existente
   * @param {number} id - ID del cliente a actualizar
   * @param {Object} clienteData - Nuevos datos del cliente
   * @returns {Promise<boolean>} True si la actualización fue exitosa
   */
  static async actualizar(id, clienteData) {
    const { 
      persona_nombre, 
      persona_apellido, 
      persona_dni, 
      persona_fecha_nac, 
      persona_domicilio,
      persona_telefono,
      cliente_email
    } = clienteData;
    
    // Verificar si el email ya existe (excluyendo el cliente actual)
    const emailExiste = await this.verificarEmailExistente(cliente_email, id);
    if (emailExiste) {
      const error = new Error('Ya existe otro cliente con ese email');
      error.code = 'EMAIL_DUPLICADO';
      throw error;
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Verificar que el cliente existe
      const [clienteExistente] = await conn.query(
        'SELECT persona_id FROM clientes WHERE cliente_id = ? AND cliente_fecha_baja IS NULL',
        [id]
      );
      
      if (clienteExistente.length === 0) {
        return false;
      }
      
      const persona_id = clienteExistente[0].persona_id;
      
      // Actualizar la persona asociada al cliente
      await conn.query(
        `UPDATE personas SET 
          persona_nombre = ?, 
          persona_apellido = ?, 
          persona_dni = ?, 
          persona_fecha_nac = ?, 
          persona_domicilio = ?,
          persona_telefono = ?
        WHERE persona_id = ?`,
        [
          persona_nombre,
          persona_apellido,
          persona_dni,
          persona_fecha_nac || null,
          persona_domicilio || null,
          persona_telefono,
          persona_id
        ]
      );
      
      // Actualizar email del cliente
      await conn.query(
        'UPDATE clientes SET cliente_email = ? WHERE cliente_id = ?',
        [cliente_email, id]
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
   * Elimina un cliente (baja lógica)
   * @param {number} id - ID del cliente a eliminar
   * @returns {Promise<boolean>} True si la eliminación fue exitosa
   */
  static async eliminar(id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Verificar que el cliente existe
      const [clienteExistente] = await conn.query(
        'SELECT cliente_id FROM clientes WHERE cliente_id = ? AND cliente_fecha_baja IS NULL',
        [id]
      );
      
      if (clienteExistente.length === 0) {
        return false;
      }
      
      // Realizar baja lógica
      await conn.query(
        'UPDATE clientes SET cliente_fecha_baja = CURRENT_TIMESTAMP WHERE cliente_id = ?',
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
   * Busca clientes por nombre, apellido o DNI
   * @param {string} termino - Término de búsqueda
   * @returns {Promise<Array>} Clientes que coinciden con el término
   */
  static async buscar(termino) {
    const terminoBusqueda = `%${termino}%`;
    
    const [clientes] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_telefono,
        c.cliente_email
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_fecha_baja IS NULL
      AND (
        p.persona_nombre LIKE ? OR
        p.persona_apellido LIKE ? OR
        p.persona_dni LIKE ?
      )
      ORDER BY p.persona_apellido, p.persona_nombre
      LIMIT 10
    `, [terminoBusqueda, terminoBusqueda, terminoBusqueda]);
    
    return clientes;
  }

  /**
   * Obtiene todos los clientes dados de baja
   * @returns {Promise<Array>} Lista de clientes eliminados
   */
  static async obtenerEliminados() {
    const [clientes] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_email,
        c.cliente_fecha_alta,
        c.cliente_fecha_baja
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_fecha_baja IS NOT NULL
      ORDER BY c.cliente_fecha_baja DESC, p.persona_apellido, p.persona_nombre
    `);
    
    return clientes;
  }

  /**
   * Reactiva un cliente dado de baja
   * @param {number} id - ID del cliente a reactivar
   * @returns {Promise<boolean>} True si la reactivación fue exitosa
   */
  static async reactivar(id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Verificar que el cliente existe y está dado de baja
      const [clienteExistente] = await conn.query(
        'SELECT cliente_id, cliente_email FROM clientes WHERE cliente_id = ? AND cliente_fecha_baja IS NOT NULL',
        [id]
      );
      
      if (clienteExistente.length === 0) {
        return false;
      }
      
      // Verificar que no hay otro cliente activo con el mismo email
      const emailExiste = await this.verificarEmailExistente(clienteExistente[0].cliente_email);
      if (emailExiste) {
        const error = new Error('No se puede reactivar: ya existe un cliente activo con ese email');
        error.code = 'EMAIL_DUPLICADO';
        throw error;
      }
      
      // Reactivar cliente (quitar fecha de baja)
      await conn.query(
        'UPDATE clientes SET cliente_fecha_baja = NULL WHERE cliente_id = ?',
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
}
