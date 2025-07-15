import UsuarioService from '../services/usuario.service.js';
import { getUsuarioConPermisos } from '../services/usuario.service.js';
import { obtenerPersonaIdDesdeToken } from './login.controller.js';

/**
 * Controlador refactorizado para usuarios
 * Mantiene las mismas funciones del controlador original pero optimizadas
 * Utiliza el servicio refactorizado para la lógica de negocio
 */
class UsuarioController {
  /**
   * Lista todos los usuarios con sus perfiles (equivalente a listarUsuarios)
   */
  static async listarUsuarios(req, res) {
    try {
      const usuarioId = obtenerPersonaIdDesdeToken(req);
      if (!usuarioId) {
        return res.status(401).json({ message: 'Token inválido o ausente' });
      }

      const usuarios = await UsuarioService.obtenerTodosLosUsuarios(usuarioId);
      
      // Mantener formato original de respuesta
      res.json(usuarios);
    } catch (error) {
      res.status(500).json({ message: 'Error al listar usuarios', error });
    }
  }

  /**
   * Agrega un nuevo usuario (equivalente a agregarUsuario)
   */
  static async agregarUsuario(req, res) {
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

      // Validaciones básicas como en el original
      if (
        !persona_nombre || !persona_apellido || !persona_dni ||
        !usuario_email || !usuario_pass
      ) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
      }

      const nuevoUsuario = await UsuarioService.crearUsuario(req.body);
      
      // Mantener formato original de respuesta
      res.status(201).json({ 
        message: 'Usuario creado correctamente', 
        usuario_id: nuevoUsuario.usuario_id 
      });
    } catch (error) {
      // Manejo de errores específicos para validación de email duplicado
      if (error.message.includes('email')) {
        return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
      }
      
      if (error.message.includes('DNI')) {
        return res.status(409).json({ message: 'Ya existe un usuario con ese DNI' });
      }
      
      res.status(500).json({ message: 'Error al crear usuario', error });
    }
  }

  /**
   * Actualiza los perfiles de un usuario (equivalente a actualizarPerfilesUsuario)
   */
  static async actualizarPerfilesUsuario(req, res) {
    try {
      const { usuario_id } = req.params;
      const { perfiles } = req.body; // Array de perfil_id

      if (!usuario_id || !Array.isArray(perfiles)) {
        return res.status(400).json({ message: 'Datos incompletos' });
      }

      await UsuarioService.actualizarPerfilesUsuario(usuario_id, perfiles);
      
      // Mantener formato original de respuesta
      res.json({ message: 'Perfiles actualizados correctamente' });
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar perfiles', error });
    }
  }
}

export default UsuarioController;
