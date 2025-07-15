import { pool } from '../db.js';
import bcrypt from 'bcrypt';

/**
 * Servicio refactorizado para usuarios
 * Solo contiene las funciones necesarias para el controlador existente
 * Mantiene la funcionalidad original incluyendo getUsuarioConPermisos
 */

// Consultas SQL necesarias para las funciones del controlador
const QUERIES = {
  // Para listarUsuarios
  OBTENER_USUARIOS: `
    SELECT 
      u.usuario_id, u.usuario_email, u.estado_usuario_id,
      p.persona_nombre, p.persona_apellido, p.persona_dni, p.persona_fecha_nac,
      eu.estado_usuario_nombre
    FROM usuarios u
    JOIN personas p ON u.persona_id = p.persona_id
    JOIN estados_usuarios eu ON u.estado_usuario_id = eu.estado_usuario_id
    WHERE u.usuario_id != ?`,
    
  OBTENER_PERFILES_USUARIOS: `
    SELECT up.usuario_id, up.perfil_id, p.perfil_descripcion
    FROM usuarios_perfiles up
    JOIN perfiles p ON up.perfil_id = p.perfil_id`,
    
  // Para agregarUsuario
  VERIFICAR_EMAIL_DUPLICADO: `
    SELECT usuario_id, usuario_email FROM usuarios WHERE usuario_email = ?`,
    
  VERIFICAR_DNI_DUPLICADO: `
    SELECT p.persona_id, p.persona_dni, u.usuario_id, u.usuario_email
    FROM personas p
    JOIN usuarios u ON p.persona_id = u.persona_id
    WHERE p.persona_dni = ?`,
    
  INSERTAR_PERSONA: `
    INSERT INTO personas (persona_nombre, persona_apellido, persona_dni, 
                         persona_fecha_nac, persona_domicilio, persona_telefono, persona_cuit)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    
  INSERTAR_USUARIO: `
    INSERT INTO usuarios (persona_id, estado_usuario_id, usuario_email, usuario_pass)
    VALUES (?, 1, ?, ?)`,
    
  // Para actualizarPerfilesUsuario
  ELIMINAR_PERFILES_USUARIO: `
    DELETE FROM usuarios_perfiles WHERE usuario_id = ?`,
    
  INSERTAR_PERFIL_USUARIO: `
    INSERT INTO usuarios_perfiles (perfil_id, usuario_id) VALUES (?, ?)`,
    
  // Para getUsuarioConPermisos (función original importante)
  OBTENER_PERFILES_USUARIO_PERMISOS: `
    SELECT up.perfil_id
    FROM usuarios_perfiles up
    WHERE up.usuario_id = ?`,
    
  OBTENER_PERMISOS_PERFILES: `
    SELECT DISTINCT pm.permiso_descripcion
    FROM perfiles_modulos_permisos pmp
    JOIN permisos pm ON pmp.permiso_id = pm.permiso_id
    JOIN perfiles p ON pmp.perfil_id = p.perfil_id
    WHERE pmp.perfil_id IN (?) AND p.perfil_estado = 'activo'`
};

class UsuarioService {
  /**
   * Obtiene todos los usuarios con sus perfiles (para listarUsuarios)
   * @param {number} usuarioIdExcluir - ID del usuario a excluir de la lista
   * @returns {Promise<Array>} Lista de usuarios con perfiles
   */
  static async obtenerTodosLosUsuarios(usuarioIdExcluir) {
    try {
      const [usuarios, perfilesUsuarios] = await Promise.all([
        pool.query(QUERIES.OBTENER_USUARIOS, [usuarioIdExcluir]),
        pool.query(QUERIES.OBTENER_PERFILES_USUARIOS)
      ]);

      // Asociar perfiles a cada usuario (lógica del controlador original)
      const usuariosConPerfiles = usuarios[0].map(usuario => ({
        ...usuario,
        perfiles: perfilesUsuarios[0]
          .filter(up => up.usuario_id === usuario.usuario_id)
          .map(up => ({
            perfil_id: up.perfil_id,
            perfil_descripcion: up.perfil_descripcion
          }))
      }));

      return usuariosConPerfiles;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }

  /**
   * Verifica si un email está duplicado (validación para agregarUsuario)
   * @param {string} email - Email a verificar
   * @returns {Promise<boolean>} true si está duplicado
   */
  static async verificarEmailDuplicado(email) {
    try {
      console.log('🔍 Verificando email duplicado:', email);
      const [result] = await pool.query(QUERIES.VERIFICAR_EMAIL_DUPLICADO, [email]);
      console.log('📋 Resultado consulta email:', result);
      const isDuplicado = result.length > 0;
      console.log('❓ Email duplicado:', isDuplicado);
      return isDuplicado;
    } catch (error) {
      console.error('❌ Error al verificar email duplicado:', error);
      throw error;
    }
  }

  /**
   * Verifica si un DNI está duplicado (validación para agregarUsuario)
   * @param {string} dni - DNI a verificar
   * @returns {Promise<boolean>} true si está duplicado
   */
  static async verificarDniDuplicado(dni) {
    try {
      console.log('🔍 Verificando DNI duplicado:', dni);
      const [result] = await pool.query(QUERIES.VERIFICAR_DNI_DUPLICADO, [dni]);
      console.log('📋 Resultado consulta DNI:', result);
      const isDuplicado = result.length > 0;
      console.log('❓ DNI duplicado:', isDuplicado);
      return isDuplicado;
    } catch (error) {
      console.error('❌ Error al verificar DNI duplicado:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo usuario (para agregarUsuario)
   * @param {Object} datosUsuario - Datos del usuario
   * @returns {Promise<Object>} Usuario creado
   */
  static async crearUsuario(datosUsuario) {
    const {
      persona_nombre,
      persona_apellido,
      persona_dni,
      persona_fecha_nac,
      persona_domicilio,
      persona_telefono,
      persona_cuit,
      usuario_email,
      usuario_pass
    } = datosUsuario;

    // Validaciones adicionales (mejora del sistema)
    console.log('🚀 Iniciando validaciones para crear usuario');
    console.log('📧 Email a validar:', usuario_email);
    console.log('🆔 DNI a validar:', persona_dni);
    
    const emailDuplicado = await this.verificarEmailDuplicado(usuario_email);
    if (emailDuplicado) {
      console.log('❌ Email duplicado detectado, cancelando operación');
      throw new Error('Ya existe un usuario con ese email');
    }

    const dniDuplicado = await this.verificarDniDuplicado(persona_dni);
    if (dniDuplicado) {
      console.log('❌ DNI duplicado detectado, cancelando operación');
      throw new Error('Ya existe un usuario con ese DNI');
    }

    console.log('✅ Validaciones pasadas, procediendo con la creación del usuario');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Insertar persona (igual que el original)
      const [personaResult] = await conn.query(QUERIES.INSERTAR_PERSONA, [
        persona_nombre,
        persona_apellido,
        persona_dni,
        persona_fecha_nac,
        persona_domicilio,
        persona_telefono,
        persona_cuit
      ]);
      const persona_id = personaResult.insertId;

      // 2. Hash de la contraseña (igual que el original)
      const hash = await bcrypt.hash(usuario_pass, 12);

      // 3. Insertar usuario (igual que el original - estado_usuario_id = 1)
      const [usuarioResult] = await conn.query(QUERIES.INSERTAR_USUARIO, [
        persona_id,
        usuario_email,
        hash
      ]);

      await conn.commit();
      
      // Devolver solo lo que necesita el controlador (igual que el original)
      return {
        usuario_id: usuarioResult.insertId
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualiza los perfiles de un usuario (para actualizarPerfilesUsuario)
   * @param {number} usuarioId - ID del usuario
   * @param {Array} perfiles - Array de perfil_id
   * @returns {Promise<void>} Resultado de la operación
   */
  static async actualizarPerfilesUsuario(usuarioId, perfiles) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Eliminar perfiles actuales (igual que el original)
      await conn.query(QUERIES.ELIMINAR_PERFILES_USUARIO, [usuarioId]);

      // Insertar nuevos perfiles (igual que el original)
      for (const perfil_id of perfiles) {
        await conn.query(QUERIES.INSERTAR_PERFIL_USUARIO, [perfil_id, usuarioId]);
      }

      await conn.commit();
      // No devolver datos extra, solo completar la operación como el original
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Función original para obtener usuario con permisos
   * IMPORTANTE: Esta función se usa en el middleware de auth
   * NO MODIFICAR NI ELIMINAR
   */
  static async getUsuarioConPermisos(usuario_id) {
    try {
      // Obtener perfiles del usuario
      const [perfiles] = await pool.query(QUERIES.OBTENER_PERFILES_USUARIO_PERMISOS, [usuario_id]);

      if (perfiles.length === 0) {
        return null; // Usuario sin perfiles
      }

      // Obtener permisos asociados a los perfiles activos
      const [permisos] = await pool.query(QUERIES.OBTENER_PERMISOS_PERFILES, [
        perfiles.map((perfil) => perfil.perfil_id)
      ]);

      return {
        usuario_id,
        permisos: permisos.map((permiso) => permiso.permiso_descripcion),
      };
    } catch (error) {
      console.error('Error al obtener permisos del usuario:', error);
      throw error;
    }
  }
}

// Exportar la función getUsuarioConPermisos para mantener compatibilidad con el middleware
export const getUsuarioConPermisos = UsuarioService.getUsuarioConPermisos;

export default UsuarioService;