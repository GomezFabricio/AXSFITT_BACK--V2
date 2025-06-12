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

// Modificar la función obtenerFaltantes para incluir también los faltantes registrados
export const obtenerFaltantes = async (req, res) => {
  try {
    // 1. Primero obtenemos productos y variantes con stock por debajo del mínimo
    const [faltantesProductos] = await pool.query(`
      SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        c.categoria_nombre AS categoria,
        COALESCE(s.cantidad, 0) AS stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        (CASE 
          WHEN s.stock_maximo IS NOT NULL THEN s.stock_maximo - COALESCE(s.cantidad, 0)
          ELSE s.stock_minimo - COALESCE(s.cantidad, 0) 
        END) AS cantidad_faltante,
        ip.imagen_url,
        'producto' AS tipo,
        f.id_faltante,
        f.fecha_deteccion
      FROM productos p
      JOIN stock s ON s.producto_id = p.producto_id
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      LEFT JOIN faltantes f ON f.producto_id = p.producto_id AND f.resuelto = FALSE
      WHERE p.producto_estado = 'activo' 
        AND s.cantidad < s.stock_minimo
        AND s.variante_id IS NULL
      ORDER BY f.id_faltante IS NULL DESC, cantidad_faltante DESC
    `);

    const [faltantesVariantes] = await pool.query(`
      SELECT 
        v.variante_id,
        p.producto_nombre AS producto_nombre,
        v.variante_sku,
        COALESCE(s.cantidad, 0) AS stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        (CASE 
          WHEN s.stock_maximo IS NOT NULL THEN s.stock_maximo - COALESCE(s.cantidad, 0)
          ELSE s.stock_minimo - COALESCE(s.cantidad, 0) 
        END) AS cantidad_faltante,
        ip.imagen_url,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
        'variante' AS tipo,
        f.id_faltante,
        f.fecha_deteccion
      FROM variantes v
      JOIN stock s ON s.variante_id = v.variante_id
      JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      LEFT JOIN faltantes f ON f.variante_id = v.variante_id AND f.resuelto = FALSE
      WHERE v.variante_estado = 'activo' 
        AND s.cantidad < s.stock_minimo
      GROUP BY v.variante_id, p.producto_nombre, v.variante_sku, s.cantidad, s.stock_minimo, s.stock_maximo, ip.imagen_url, f.id_faltante, f.fecha_deteccion
      ORDER BY f.id_faltante IS NULL DESC, cantidad_faltante DESC
    `);

    // Combinar los resultados
    const faltantes = [...faltantesProductos, ...faltantesVariantes];
    
    res.status(200).json(faltantes);
  } catch (error) {
    console.error('Error al obtener faltantes:', error);
    res.status(500).json({ message: 'Error interno al obtener faltantes.' });
  }
};

// Función para registrar un faltante en la tabla de faltantes
export const registrarFaltante = async (req, res) => {
  try {
    const { producto_id, variante_id, cantidad_faltante } = req.body;
    
    if ((!producto_id && !variante_id) || !cantidad_faltante) {
      return res.status(400).json({ 
        message: 'Debe especificar un producto o variante y la cantidad faltante' 
      });
    }
    
    // Verificar si ya existe un registro de faltante no resuelto
    const [faltanteExistente] = await pool.query(
      `SELECT id_faltante FROM faltantes 
       WHERE ${producto_id ? 'producto_id = ?' : 'variante_id = ?'} 
       AND resuelto = FALSE`,
      [producto_id || variante_id]
    );
    
    if (faltanteExistente.length > 0) {
      // Actualizar el faltante existente
      await pool.query(
        `UPDATE faltantes 
         SET cantidad_faltante = ?, fecha_deteccion = CURRENT_TIMESTAMP 
         WHERE id_faltante = ?`,
        [cantidad_faltante, faltanteExistente[0].id_faltante]
      );
      
      return res.status(200).json({ 
        message: 'Faltante actualizado correctamente',
        id_faltante: faltanteExistente[0].id_faltante
      });
    }
    
    // Insertar nuevo faltante
    const [result] = await pool.query(
      `INSERT INTO faltantes (producto_id, variante_id, cantidad_faltante) 
       VALUES (?, ?, ?)`,
      [producto_id || null, variante_id || null, cantidad_faltante]
    );
    
    res.status(201).json({ 
      message: 'Faltante registrado correctamente',
      id_faltante: result.insertId
    });
  } catch (error) {
    console.error('Error al registrar faltante:', error);
    res.status(500).json({ message: 'Error interno al registrar faltante.' });
  }
};

// Función para marcar un faltante como resuelto
export const resolverFaltante = async (req, res) => {
  try {
    const { id_faltante } = req.params;
    
    const [result] = await pool.query(
      `UPDATE faltantes SET resuelto = TRUE WHERE id_faltante = ?`,
      [id_faltante]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Faltante no encontrado.' });
    }
    
    res.status(200).json({ message: 'Faltante marcado como resuelto.' });
  } catch (error) {
    console.error('Error al resolver faltante:', error);
    res.status(500).json({ message: 'Error interno al resolver faltante.' });
  }
};
