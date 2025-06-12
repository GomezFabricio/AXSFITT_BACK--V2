import { pool } from '../db.js';

export const obtenerStock = async (req, res) => {
  try {
    // Obtener productos con información del stock
    const [productos] = await pool.query(`
      SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        c.categoria_nombre AS categoria,
        COALESCE(SUM(s.cantidad), 0) AS stock_total,
        ip.imagen_url,
        p.producto_visible,
        p.producto_estado,
        COALESCE(s.stock_minimo, 0) AS stock_minimo,  -- Usar COALESCE para manejar valores NULL
        COALESCE(s.stock_maximo, NULL) AS stock_maximo -- Usar COALESCE para manejar valores NULL
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      WHERE p.producto_estado = 'activo'
      GROUP BY p.producto_id, ip.imagen_url, c.categoria_nombre, p.producto_visible, p.producto_estado, s.stock_minimo, s.stock_maximo
      ORDER BY p.producto_nombre ASC
    `);

    // Obtener variantes con información del stock
    for (const producto of productos) {
      const [variantes] = await pool.query(`
        SELECT 
          v.variante_id,
          v.variante_sku,
          COALESCE(s.cantidad, 0) AS stock_total,
          ip.imagen_url,
          vv.valor_nombre,
          a.atributo_nombre,
          v.variante_estado,
          COALESCE(s.stock_minimo, 0) AS stock_minimo,  -- Usar COALESCE para manejar valores NULL
          COALESCE(s.stock_maximo, NULL) AS stock_maximo -- Usar COALESCE para manejar valores NULL
        FROM variantes v
        LEFT JOIN stock s ON s.variante_id = v.variante_id
        LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
        LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
        LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
        WHERE v.producto_id = ? AND v.variante_estado = 'activo'
      `, [producto.producto_id]);
      producto.variantes = variantes;
    }

    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ message: 'Error interno al obtener productos.' });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimo, stock_maximo, tipo } = req.body;

    if (!['producto', 'variante'].includes(tipo)) {
      return res.status(400).json({ message: "Tipo inválido. Debe ser 'producto' o 'variante'" });
    }

    const campoClave = tipo === 'producto' ? 'producto_id' : 'variante_id';

    const [stockExistente] = await pool.query(
      `SELECT stock_id FROM stock WHERE ${campoClave} = ?`,
      [id]
    );

    if (stockExistente.length > 0) {
      await pool.query(
        `UPDATE stock SET stock_minimo = ?, stock_maximo = ? WHERE ${campoClave} = ?`,
        [stock_minimo, stock_maximo, id]
      );
    } else {
      return res.status(404).json({ message: "Registro de stock no encontrado. No se puede crear uno nuevo automáticamente." });
    }

    res.json({ message: "Stock actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar el stock:", error);
    return res.status(500).json({ message: "Error al actualizar el stock" });
  }
};
