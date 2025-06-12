import { pool } from '../db.js';

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimo, stock_maximo } = req.body;

    // Determine if the ID is for a product or a variant
    const [producto] = await pool.query("SELECT * FROM productos WHERE producto_id = ?", [id]);
    const [variante] = await pool.query("SELECT * FROM variantes WHERE variante_id = ?", [id]);

    let isProducto = producto.length > 0;
    let isVariante = variante.length > 0;

    if (!isProducto && !isVariante) {
      return res.status(404).json({ message: "Producto o variante no encontrado" });
    }

    let updateQuery = "";
    if (isProducto) {
      updateQuery = "UPDATE stock SET stock_minimo = ?, stock_maximo = ? WHERE producto_id = ?";
    } else {
      updateQuery = "UPDATE stock SET stock_minimo = ?, stock_maximo = ? WHERE variante_id = ?";
    }

    // Actualizar el stock en la base de datos
    await pool.query(
      updateQuery,
      [stock_minimo, stock_maximo, id]
    );

    res.json({ message: "Stock actualizado correctamente" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al actualizar el stock" });
  }
};