import { pool } from '../db.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../config.js';
import bcrypt from 'bcrypt';
import transporter from '../emailConfig.js';

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

    // Obtener módulos y permisos del usuario (por perfiles)
    const [modulosPermisos] = await pool.query(
      `
      SELECT DISTINCT
        m.modulo_id,
        m.modulo_padre_id,
        m.modulo_descripcion,
        p.permiso_id,
        p.permiso_descripcion,
        p.permiso_ruta,
        p.permiso_visible_menu
      FROM usuarios_perfiles up
      JOIN perfiles_modulos_permisos pmp ON up.perfil_id = pmp.perfil_id
      JOIN modulos m ON pmp.modulo_id = m.modulo_id
      JOIN permisos p ON pmp.permiso_id = p.permiso_id
      WHERE up.usuario_id = ?

      UNION

      -- Incluye módulos padres aunque no tengan permisos directos
      SELECT DISTINCT
        mp.modulo_id,
        mp.modulo_padre_id,
        mp.modulo_descripcion,
        NULL as permiso_id,
        NULL as permiso_descripcion,
        NULL as permiso_ruta,
        NULL as permiso_visible_menu
      FROM (
        SELECT m2.*
        FROM usuarios_perfiles up
        JOIN perfiles_modulos_permisos pmp ON up.perfil_id = pmp.perfil_id
        JOIN modulos m1 ON pmp.modulo_id = m1.modulo_id
        JOIN modulos m2 ON m1.modulo_padre_id = m2.modulo_id
        WHERE up.usuario_id = ?
      ) mp
      `,
      [usuario.usuario_id, usuario.usuario_id]
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
          permiso_ruta: item.permiso_ruta,
          permiso_visible_menu: item.permiso_visible_menu
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

// Nueva función para solicitar recuperación de contraseña
export const solicitarRecuperacionPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'El email es obligatorio' });
  }

  try {
    // Verificar si el usuario existe
    const [usuarios] = await pool.query(
      'SELECT usuario_id, usuario_email FROM usuarios WHERE usuario_email = ?',
      [email]
    );

    if (usuarios.length === 0) {
      // Por seguridad, no informamos si el email existe o no
      return res.status(200).json({
        message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña'
      });
    }

    const usuario = usuarios[0];

    // Crear un token JWT que expira en 24 horas
    const resetToken = jwt.sign(
      { 
        usuario_id: usuario.usuario_id,
        email: usuario.usuario_email,
        tipo: 'password_reset' // Marcar como token de recuperación
      },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    // URL de recuperación
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer-password/${resetToken}`;

    // Enviar email
    await transporter.sendMail({
      from: '"AXSFITT" <noreply@axsfitt.com>',
      to: email,
      subject: 'Recuperación de contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6d28d9;">Recuperación de Contraseña</h2>
          <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
          <p>Para continuar, haz clic en el siguiente enlace:</p>
          <p>
            <a 
              href="${resetUrl}" 
              style="background-color: #6d28d9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;"
            >
              Restablecer Contraseña
            </a>
          </p>
          <p>Este enlace expirará en 24 horas.</p>
          <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
          <p>Saludos,<br/>El equipo de AXSFITT</p>
        </div>
      `
    });

    res.status(200).json({
      message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña'
    });
  } catch (error) {
    console.error('Error al solicitar recuperación de contraseña:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Verificar token de recuperación
export const verificarTokenRecuperacion = async (req, res) => {
  const { token } = req.params;

  try {
    // Verificar el token
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // Verificar que sea un token de recuperación
    if (!decoded || decoded.tipo !== 'password_reset') {
      return res.status(400).json({ message: 'Token inválido' });
    }

    res.status(200).json({ message: 'Token válido' });
  } catch (error) {
    console.error('Error al verificar token:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'El enlace ha expirado' });
    }
    res.status(400).json({ message: 'Token inválido o expirado' });
  }
};

// Restablecer contraseña
export const restablecerPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  try {
    // Verificar el token
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // Verificar que sea un token de recuperación
    if (!decoded || decoded.tipo !== 'password_reset') {
      return res.status(400).json({ message: 'Token inválido' });
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña
    await pool.query(
      'UPDATE usuarios SET usuario_pass = ? WHERE usuario_id = ?',
      [hashedPassword, decoded.usuario_id]
    );

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'El enlace ha expirado' });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};