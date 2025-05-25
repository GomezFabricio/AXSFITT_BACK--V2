import { pool } from '../db.js';

// Listar todos los perfiles con módulos y permisos asociados y cantidad de usuarios
export const listarPerfiles = async (req, res) => {
  try {
    const [perfiles] = await pool.query(
      `SELECT perfil_id, perfil_descripcion FROM perfiles WHERE perfil_estado = 'activo'`
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

// Alta de perfil con módulos y permisos
export const crearPerfil = async (req, res) => {
  const { perfil_descripcion, modulosPermisos } = req.body;
  // modulosPermisos: [{ modulo_id, permisos: [permiso_id, ...] }, ...]
  if (!perfil_descripcion || !Array.isArray(modulosPermisos) || modulosPermisos.length === 0) {
    return res.status(400).json({ message: 'Datos incompletos' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 1. Crear el perfil
    const [result] = await conn.query(
      `INSERT INTO perfiles (perfil_descripcion, perfil_estado) VALUES (?, 'activo')`,
      [perfil_descripcion]
    );
    const perfil_id = result.insertId;

    // 2. Insertar permisos para cada módulo
    for (const mp of modulosPermisos) {
      for (const permiso_id of mp.permisos) {
        await conn.query(
          `INSERT INTO perfiles_modulos_permisos (perfil_id, modulo_id, permiso_id) VALUES (?, ?, ?)`,
          [perfil_id, mp.modulo_id, permiso_id]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: 'Perfil creado correctamente', perfil_id });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: 'Error al crear perfil', error });
  } finally {
    conn.release();
  }
};

// Modificar perfil: nombre, módulos y permisos
export const modificarPerfil = async (req, res) => {
  const { perfil_id } = req.params;
  const { perfil_descripcion, modulosPermisos } = req.body;
  if (!perfil_id || !perfil_descripcion || !Array.isArray(modulosPermisos)) {
    return res.status(400).json({ message: 'Datos incompletos' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 1. Actualizar nombre
    await conn.query(
      `UPDATE perfiles SET perfil_descripcion = ? WHERE perfil_id = ?`,
      [perfil_descripcion, perfil_id]
    );
    // 2. Eliminar permisos actuales
    await conn.query(
      `DELETE FROM perfiles_modulos_permisos WHERE perfil_id = ?`,
      [perfil_id]
    );
    // 3. Insertar nuevos permisos
    for (const mp of modulosPermisos) {
      for (const permiso_id of mp.permisos) {
        await conn.query(
          `INSERT INTO perfiles_modulos_permisos (perfil_id, modulo_id, permiso_id) VALUES (?, ?, ?)`,
          [perfil_id, mp.modulo_id, permiso_id]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'Perfil modificado correctamente' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ message: 'Error al modificar perfil', error });
  } finally {
    conn.release();
  }
};

// Baja lógica de perfil (cambia el estado a 'inactivo')
export const eliminarPerfil = async (req, res) => {
  const { perfil_id } = req.params;
  if (!perfil_id) {
    return res.status(400).json({ message: 'Falta el ID del perfil' });
  }
  try {
    const [result] = await pool.query(
      `UPDATE perfiles SET perfil_estado = 'inactivo' WHERE perfil_id = ?`,
      [perfil_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Perfil no encontrado' });
    }
    res.json({ message: 'Perfil dado de baja correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al dar de baja el perfil', error });
  }
};