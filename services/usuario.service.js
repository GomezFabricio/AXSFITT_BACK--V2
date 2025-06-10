import { pool } from '../db.js';

export const getUsuarioConPermisos = async (usuario_id) => {
  try {
    // Obtener perfiles del usuario
    const [perfiles] = await pool.query(
      `SELECT up.perfil_id
       FROM usuarios_perfiles up
       WHERE up.usuario_id = ?`,
      [usuario_id]
    );

    if (perfiles.length === 0) {
      return null; // Usuario sin perfiles
    }

    // Obtener permisos asociados a los perfiles
    const [permisos] = await pool.query(
      `SELECT DISTINCT pm.permiso_descripcion
       FROM perfiles_modulos_permisos pmp
       JOIN permisos pm ON pmp.permiso_id = pm.permiso_id
       WHERE pmp.perfil_id IN (?)`,
      [perfiles.map((perfil) => perfil.perfil_id)]
    );

    return {
      usuario_id,
      permisos: permisos.map((permiso) => permiso.permiso_descripcion),
    };
  } catch (error) {
    console.error('Error al obtener permisos del usuario:', error);
    throw error;
  }
};