import { pool } from '../db.js';
import { obtenerPersonaIdDesdeToken } from './login.controller.js';

export const listarUsuarios = async (req, res) => {
  try {
    const usuarioId = obtenerPersonaIdDesdeToken(req);
    if (!usuarioId) {
      return res.status(401).json({ message: 'Token inválido o ausente' });
    }

    const [usuarios] = await pool.query(
      `SELECT 
        u.usuario_id, u.usuario_email, u.estado_usuario_id,
        p.persona_nombre, p.persona_apellido, p.persona_dni, p.persona_fecha_nac,
        eu.estado_usuario_nombre
      FROM usuarios u
      JOIN personas p ON u.persona_id = p.persona_id
      JOIN estados_usuarios eu ON u.estado_usuario_id = eu.estado_usuario_id
      WHERE u.usuario_id != ?`,
      [usuarioId]
    );

    // Obtener perfiles de cada usuario
    const [usuariosPerfiles] = await pool.query(
      `SELECT up.usuario_id, up.perfil_id, p.perfil_descripcion
       FROM usuarios_perfiles up
       JOIN perfiles p ON up.perfil_id = p.perfil_id`
    );

    // Asociar perfiles a cada usuario
    const usuariosConPerfiles = usuarios.map(usuario => ({
      ...usuario,
      perfiles: usuariosPerfiles
        .filter(up => up.usuario_id === usuario.usuario_id)
        .map(up => ({
          perfil_id: up.perfil_id,
          perfil_descripcion: up.perfil_descripcion
        }))
    }));

    res.json(usuariosConPerfiles);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar usuarios', error });
  }
};