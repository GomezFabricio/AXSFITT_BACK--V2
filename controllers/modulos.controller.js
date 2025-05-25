import { pool } from '../db.js';

// Listar todos los módulos con cantidad de usuarios asignados (por perfil) y permisos asociados
export const listarModulos = async (req, res) => {
  try {
    const [modulos] = await pool.query(
      `SELECT 
          m.modulo_id, 
          m.modulo_padre_id, 
          m.modulo_descripcion,
          (
            SELECT COUNT(DISTINCT up.usuario_id)
            FROM usuarios_perfiles up
            JOIN perfiles_modulos_permisos pmp ON up.perfil_id = pmp.perfil_id
            WHERE pmp.modulo_id = m.modulo_id
          ) as usuarios_asignados
       FROM modulos m`
    );

    // Obtener permisos asociados a cada módulo
    const [permisos] = await pool.query(
      `SELECT permiso_id, modulo_id, permiso_descripcion FROM permisos`
    );

    // Asociar permisos a cada módulo
    const modulosConPermisos = modulos.map(mod => ({
      ...mod,
      permisos: permisos.filter(p => p.modulo_id === mod.modulo_id)
    }));

    res.json(modulosConPermisos);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar módulos', error });
  }
};

// Modificar solo el nombre (descripcion) de un módulo
export const modificarModulo = async (req, res) => {
  const { modulo_id } = req.params;
  const { modulo_descripcion } = req.body;

  if (!modulo_descripcion || !modulo_id) {
    return res.status(400).json({ message: 'Datos incompletos' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE modulos SET modulo_descripcion = ? WHERE modulo_id = ?`,
      [modulo_descripcion, modulo_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Módulo no encontrado' });
    }

    res.json({ message: 'Nombre del módulo actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al modificar el módulo', error });
  }
};