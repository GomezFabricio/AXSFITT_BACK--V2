import { pool } from '../db.js';

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimo, stock_maximo } = req.body;

    // Validar que el producto exista
    const [producto] = await pool.query("SELECT * FROM productos WHERE producto_id = ?", [id]);
    if (producto.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Actualizar el stock en la base de datos
    await pool.query(
      "UPDATE stock SET stock_minimo = ?, stock_maximo = ? WHERE producto_id = ?",
      [stock_minimo, stock_maximo, id]
    );

    res.json({ message: "Stock actualizado correctamente" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al actualizar el stock" });
  }
};