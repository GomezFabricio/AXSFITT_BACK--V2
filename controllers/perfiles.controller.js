import { pool } from '../db.js';

// Listar todos los perfiles con módulos asociados y cantidad de usuarios
export const listarPerfiles = async (req, res) => {
  try {
    const [perfiles] = await pool.query(
      `SELECT perfil_id, perfil_descripcion FROM perfiles`
    );

    // Módulos asociados a cada perfil
    const [modulos] = await pool.query(
      `SELECT pm.perfil_id, m.modulo_id, m.modulo_descripcion
       FROM perfiles_modulos pm
       JOIN modulos m ON pm.modulo_id = m.modulo_id`
    );

    // Cantidad de usuarios por perfil
    const [usuarios] = await pool.query(
      `SELECT perfil_id, COUNT(usuario_id) as cantidad_usuarios
       FROM usuarios_perfiles
       GROUP BY perfil_id`
    );

    // Asociar módulos y cantidad de usuarios a cada perfil
    const perfilesCompletos = perfiles.map(perfil => ({
      ...perfil,
      modulos: modulos
        .filter(m => m.perfil_id === perfil.perfil_id)
        .map(m => ({ modulo_id: m.modulo_id, modulo_descripcion: m.modulo_descripcion })),
      cantidad_usuarios: (usuarios.find(u => u.perfil_id === perfil.perfil_id) || {}).cantidad_usuarios || 0
    }));

    res.json(perfilesCompletos);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar perfiles', error });
  }
};