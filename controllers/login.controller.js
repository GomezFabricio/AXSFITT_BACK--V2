import { pool } from '../db.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../config.js';
import bcrypt from 'bcrypt';

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Consulta usuario básica
    const [rows] = await pool.query(
      `SELECT 
        u.usuario_id,
        u.usuario_email,
        u.usuario_pass,
        p.persona_nombre,
        p.persona_apellido,
        e.estado_usuario_nombre,
        e.estado_usuario_id
      FROM usuarios u
      JOIN estados_usuarios e ON u.estado_usuario_id = e.estado_usuario_id
      JOIN personas p ON u.persona_id = p.persona_id
      WHERE u.usuario_email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const usuario = rows[0];

    if (usuario.estado_usuario_id !== 1) {
      return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
    }

    const isMatch = await bcrypt.compare(password, usuario.usuario_pass);

    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Obtener perfiles del usuario
    const [perfiles] = await pool.query(
      `SELECT 
        p.perfil_id,
        p.perfil_descripcion
      FROM perfiles p
      JOIN usuarios_perfiles up ON p.perfil_id = up.perfil_id
      WHERE up.usuario_id = ?`,
      [usuario.usuario_id]
    );

    // Obtener módulos y permisos del usuario (incluyendo modulo_padre_id y modulo_ruta)
    const [modulosPermisos] = await pool.query(
      `
      -- Permisos directos y por perfil
      SELECT DISTINCT
        m.modulo_id,
        m.modulo_padre_id,
        m.modulo_descripcion,
        p.permiso_id,
        p.permiso_descripcion,
        p.permiso_ruta
      FROM usuarios_modulos_permisos ump
      JOIN modulos m ON ump.modulo_id = m.modulo_id
      JOIN permisos p ON ump.permiso_id = p.permiso_id
      WHERE ump.usuario_id = ?
    
      UNION
    
      SELECT DISTINCT
        m.modulo_id,
        m.modulo_padre_id,
        m.modulo_descripcion,
        p.permiso_id,
        p.permiso_descripcion,
        p.permiso_ruta
      FROM usuarios_perfiles up
      JOIN perfiles_modulos pm ON up.perfil_id = pm.perfil_id
      JOIN modulos m ON pm.modulo_id = m.modulo_id
      JOIN permisos p ON p.modulo_id = m.modulo_id
      WHERE up.usuario_id = ?
    
      UNION
    
      -- Incluye módulos padres aunque no tengan permisos directos
      SELECT DISTINCT
        mp.modulo_id,
        mp.modulo_padre_id,
        mp.modulo_descripcion,
        NULL as permiso_id,
        NULL as permiso_descripcion,
        NULL as permiso_ruta
      FROM (
        SELECT m2.*
        FROM usuarios_modulos_permisos ump
        JOIN modulos m1 ON ump.modulo_id = m1.modulo_id
        JOIN modulos m2 ON m1.modulo_padre_id = m2.modulo_id
        WHERE ump.usuario_id = ?
        UNION
        SELECT m2.*
        FROM usuarios_perfiles up
        JOIN perfiles_modulos pm ON up.perfil_id = pm.perfil_id
        JOIN modulos m1 ON pm.modulo_id = m1.modulo_id
        JOIN modulos m2 ON m1.modulo_padre_id = m2.modulo_id
        WHERE up.usuario_id = ?
      ) mp
      `,
      [usuario.usuario_id, usuario.usuario_id, usuario.usuario_id, usuario.usuario_id]
    );
    
    // Agrupar módulos y permisos de manera estructurada
    const modulos = [];
    modulosPermisos.forEach(item => {
      let modulo = modulos.find(m => m.modulo_id === item.modulo_id);
    
      if (!modulo) {
        modulo = {
          modulo_id: item.modulo_id,
          modulo_padre_id: item.modulo_padre_id,
          modulo_descripcion: item.modulo_descripcion,
          permisos: []
        };
        modulos.push(modulo);
      }
    
      if (item.permiso_id && !modulo.permisos.some(p => p.permiso_id === item.permiso_id)) {
        modulo.permisos.push({
          permiso_id: item.permiso_id,
          permiso_descripcion: item.permiso_descripcion,
          permiso_ruta: item.permiso_ruta
        });
      }
    });
    const token = jwt.sign(
      {
        usuario_id: usuario.usuario_id,
        email: usuario.usuario_email
      },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    // Crear objeto usuario con datos relevantes
    const userData = {
      usuario_id: usuario.usuario_id,
      email: usuario.usuario_email,
      nombre: usuario.persona_nombre,
      apellido: usuario.persona_apellido,
      perfiles,
      modulos
    };

    res.json({
      message: 'Login exitoso',
      token,
      usuario: userData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const obtenerPersonaIdDesdeToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    return decoded.usuario_id || null;
  } catch (error) {
    return null;
  }
};