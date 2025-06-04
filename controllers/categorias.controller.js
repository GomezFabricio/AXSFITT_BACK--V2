import { pool } from '../db.js';

/**
 * Crea una nueva categoría o subcategoría.
 */
export const crearCategoria = async (req, res) => {
  const { categoria_nombre, categoria_descripcion, categoria_padre_id } = req.body;

  if (!categoria_nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
  }

  try {
    const [ordenRows] = await pool.query(
      'SELECT COALESCE(MAX(categoria_orden), 0) + 1 AS nuevo_orden FROM categorias WHERE categoria_padre_id <=> ?',
      [categoria_padre_id || null]
    );
    const nuevoOrden = ordenRows[0].nuevo_orden;

    const [result] = await pool.query(
      'INSERT INTO categorias (categoria_nombre, categoria_descripcion, categoria_padre_id, categoria_estado, categoria_orden) VALUES (?, ?, ?, ?, ?)',
      [categoria_nombre, categoria_descripcion || null, categoria_padre_id || null, 'activa', nuevoOrden]
    );

    res.status(201).json({
      message: 'Categoría creada exitosamente.',
      categoria_id: result.insertId,
    });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ message: 'Error interno al crear la categoría.' });
  }
};

/**
 * Agrega una subcategoría (usa el mismo mecanismo que crearCategoria).
 */
export const agregarSubcategoria = crearCategoria;

/**
 * Modifica una categoría existente.
 */
export const modificarCategoria = async (req, res) => {
  const { categoria_id } = req.params;
  const { categoria_nombre, categoria_descripcion, categoria_padre_id } = req.body;

  if (!categoria_nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE categorias SET categoria_nombre = ?, categoria_descripcion = ?, categoria_padre_id = ? WHERE categoria_id = ?',
      [categoria_nombre, categoria_descripcion || null, categoria_padre_id || null, categoria_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }

    res.status(200).json({ message: 'Categoría modificada exitosamente.' });
  } catch (error) {
    console.error('Error al modificar categoría:', error);
    res.status(500).json({ message: 'Error interno al modificar la categoría.' });
  }
};

/**
 * Elimina una categoría (baja lógica) y sus subcategorías.
 */
export const eliminarCategoria = async (req, res) => {
  const { categoria_id } = req.params;

  try {
    const [result] = await pool.query(
      "UPDATE categorias SET categoria_estado = 'inactiva' WHERE categoria_id = ?",
      [categoria_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }

    await pool.query(
      "UPDATE categorias SET categoria_estado = 'inactiva' WHERE categoria_padre_id = ?",
      [categoria_id]
    );

    res.status(200).json({ message: 'Categoría y sus subcategorías inactivadas exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ message: 'Error interno al eliminar la categoría.' });
  }
};

/**
 * Reordena categorías o subcategorías.
 * Espera un array: [{ categoria_id, categoria_orden }, ...]
 */
export const reordenarCategorias = async (req, res) => {
  const nuevasOrdenes = req.body;

  if (!Array.isArray(nuevasOrdenes)) {
    return res.status(400).json({ message: 'Formato inválido: se espera un arreglo.' });
  }

  try {
    const updates = nuevasOrdenes.map(({ categoria_id, categoria_orden }) =>
      pool.query(
        'UPDATE categorias SET categoria_orden = ? WHERE categoria_id = ?',
        [categoria_orden, categoria_id]
      )
    );

    await Promise.all(updates);

    res.status(200).json({ message: 'Orden actualizado correctamente.' });
  } catch (error) {
    console.error('Error al reordenar categorías:', error);
    res.status(500).json({ message: 'Error interno al reordenar categorías.' });
  }
};
