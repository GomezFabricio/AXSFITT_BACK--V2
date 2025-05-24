import { pool } from '../db.js';

// Listar todos los perfiles con módulos y permisos asociados y cantidad de usuarios
export const listarPerfiles = async (req, res) => {
  try {
    const [perfiles] = await pool.query(
      `SELECT perfil_id, perfil_descripcion FROM perfiles`
    );

    // Módulos y permisos asociados a cada perfil
    const [modulosPermisos] = await pool.query(
      `SELECT 
          pmp.perfil_id, 
          m.modulo_id, 
          m.modulo_descripcion,
          p.permiso_id,
          p.permiso_descripcion
       FROM perfiles_modulos_permisos pmp
       JOIN modulos m ON pmp.modulo_id = m.modulo_id
       JOIN permisos p ON pmp.permiso_id = p.permiso_id`
    );

    // Cantidad de usuarios por perfil
    const [usuarios] = await pool.query(
      `SELECT perfil_id, COUNT(usuario_id) as cantidad_usuarios
       FROM usuarios_perfiles
       GROUP BY perfil_id`
    );

    // Asociar módulos y permisos y cantidad de usuarios a cada perfil
    const perfilesCompletos = perfiles.map(perfil => {
      // Agrupar módulos y sus permisos
      const modulos = [];
      modulosPermisos
        .filter(mp => mp.perfil_id === perfil.perfil_id)
        .forEach(mp => {
          let modulo = modulos.find(m => m.modulo_id === mp.modulo_id);
          if (!modulo) {
            modulo = {
              modulo_id: mp.modulo_id,
              modulo_descripcion: mp.modulo_descripcion,
              permisos: []
            };
            modulos.push(modulo);
          }
          modulo.permisos.push({
            permiso_id: mp.permiso_id,
            permiso_descripcion: mp.permiso_descripcion
          });
        });

      return {
        ...perfil,
        modulos,
        cantidad_usuarios: (usuarios.find(u => u.perfil_id === perfil.perfil_id) || {}).cantidad_usuarios || 0
      };
    });

    res.json(perfilesCompletos);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar perfiles', error });
  }
};