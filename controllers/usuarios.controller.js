import { pool } from '../db.js';
import { obtenerPersonaIdDesdeToken } from './login.controller.js';
import bcrypt from 'bcrypt';

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


export const agregarUsuario = async (req, res) => {
  try {
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
    } = req.body;

    if (
      !persona_nombre || !persona_apellido || !persona_dni ||
      !usuario_email || !usuario_pass
    ) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    // 1. Insertar persona
    const [personaResult] = await pool.query(
      `INSERT INTO personas (persona_nombre, persona_apellido, persona_dni, persona_fecha_nac, persona_domicilio, persona_telefono, persona_cuit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [persona_nombre, persona_apellido, persona_dni, persona_fecha_nac, persona_domicilio, persona_telefono, persona_cuit]
    );
    const persona_id = personaResult.insertId;

    // 2. Insertar usuario (por defecto estado_usuario_id = 1, que es 'Activo')
    const hash = await bcrypt.hash(usuario_pass, 12);
    const [usuarioResult] = await pool.query(
      `INSERT INTO usuarios (persona_id, estado_usuario_id, usuario_email, usuario_pass)
       VALUES (?, 1, ?, ?)`,
      [persona_id, usuario_email, hash]
    );

    res.status(201).json({ message: 'Usuario creado correctamente', usuario_id: usuarioResult.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear usuario', error });
  }
};