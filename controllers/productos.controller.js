import { pool } from '../db.js';
import fs from 'fs';
import path from 'path';

// Función para dar de alta un producto con atributos y variantes
export const crearProducto = async (req, res) => {
  const {
    usuario_id,
    producto_nombre,
    categoria_id,
    producto_descripcion,
    producto_precio_venta,
    producto_precio_costo,
    producto_precio_oferta,
    producto_sku,
    producto_stock,
    imagenes,
    atributos,
    variantes,
  } = req.body;

  if (!producto_nombre || !categoria_id) {
    return res.status(400).json({ message: 'El nombre del producto y la categoría son obligatorios.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Determinar el estado del producto
    const producto_estado = producto_precio_venta ? 'activo' : 'pendiente';

    // 1. Insertar el producto
    const [productoResult] = await conn.query(
      `INSERT INTO productos (
        categoria_id,
        producto_nombre,
        producto_descripcion,
        producto_precio_venta,
        producto_precio_costo,
        producto_precio_oferta,
        producto_sku,
        producto_estado,
        producto_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoria_id,
        producto_nombre,
        producto_descripcion || null,
        producto_precio_venta || null,
        producto_precio_costo || null,
        producto_precio_oferta || null,
        producto_sku || null,
        producto_estado,
        true, // Valor por defecto para producto_visible
      ]
    );
    const producto_id = productoResult.insertId;

    // 2. Insertar el stock del producto (si tiene stock inicial)
    if (producto_stock) {
      await conn.query(
        `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
        [producto_id, producto_stock]
      );
    }

    // 3. Mover imágenes de la tabla temporal a la definitiva
    if (imagenes && imagenes.length > 0) {
      const imagenQueries = imagenes.map((imagen, index) =>
        conn.query(
          `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden)
          SELECT ?, imagen_url, ?
          FROM imagenes_temporales
          WHERE usuario_id = ? AND imagen_id = ?`,
          [producto_id, index, usuario_id, imagen.id]
        )
      );
      await Promise.all(imagenQueries);

      // Eliminar las imágenes de la tabla temporal
      await conn.query(`DELETE FROM imagenes_temporales WHERE usuario_id = ?`, [usuario_id]);
    }

    // 4. Insertar atributos
    const atributoIds = {};
    if (atributos && atributos.length > 0) {
      for (const atributo of atributos) {
        const [atributoResult] = await conn.query(
          `INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)`,
          [producto_id, atributo.atributo_nombre]
        );
        const atributo_id = atributoResult.insertId;
        atributoIds[atributo.atributo_nombre] = atributo_id;
      }
    }

    // 5. Insertar variantes
    if (variantes && variantes.length > 0) {
      for (const variante of variantes) {
        let imagen_id = null;

        // Obtener imagen_id desde la tabla imagenes_productos usando imagen_url
        if (variante.imagen_url) {
          const [imagenResult] = await conn.query(
            `SELECT imagen_id FROM imagenes_productos WHERE producto_id = ? AND imagen_url = ?`,
            [producto_id, variante.imagen_url]
          );

          if (imagenResult.length > 0) {
            imagen_id = imagenResult[0].imagen_id;
          } else {
            console.error(`No se encontró imagen_id para la URL: ${variante.imagen_url}`);
          }
        }

        console.log('Buscando imagen_id con producto_id:', producto_id, 'y imagen_url:', variante.imagen_url);

        // Determinar el estado de la variante
        const variante_estado = variante.precio_venta ? 'activo' : 'pendiente';

        // Insertar variante
        const [varianteResult] = await conn.query(
          `INSERT INTO variantes (
            producto_id,
            imagen_id,
            variante_precio_venta,
            variante_precio_costo,
            variante_precio_oferta,
            variante_sku,
            variante_estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            producto_id,
            imagen_id,
            variante.precio_venta,
            variante.precio_costo || null,
            variante.precio_oferta || null,
            variante.sku || null,
            variante_estado,
          ]
        );
        const variante_id = varianteResult.insertId;

        // Insertar stock de la variante (si tiene stock inicial)
        if (variante.stock) {
          await conn.query(
            `INSERT INTO stock (variante_id, cantidad) VALUES (?, ?)`,
            [variante_id, variante.stock]
          );
        }

        // Insertar valores asociados a la variante
        const valorQueries = variante.valores.map(valor => {
          const atributo_nombre = Object.keys(atributoIds).find(nombre =>
            atributos.some(attr => attr.atributo_nombre === nombre && valor === valor)
          );

          if (!atributo_nombre) {
            throw new Error(`No se encontró el atributo relacionado con el valor: ${valor}`);
          }

          const atributo_id = atributoIds[atributo_nombre];

          return conn.query(
            `INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)`,
            [variante_id, atributo_id, valor]
          );
        });

        await Promise.all(valorQueries);
      }
    }

    await conn.commit();
    res.status(201).json({ message: 'Producto creado exitosamente.', producto_id });
  } catch (error) {
    await conn.rollback();
    console.error('Error al crear producto:', error);
    res.status(500).json({ message: 'Error interno al crear el producto.' });
  } finally {
    conn.release();
  }
};

// Guardar imágenes en la tabla temporal
export const guardarImagenTemporal = async (req, res) => {
  const { usuario_id, imagen_orden } = req.body;

  if (!usuario_id || !req.file) {
    return res.status(400).json({ message: 'El usuario y la imagen son obligatorios.' });
  }

  try {
    const imagen_url = `/uploads/${req.file.filename}`; // Ruta relativa de la imagen subida

    const [result] = await pool.query(
      `INSERT INTO imagenes_temporales (usuario_id, imagen_url, imagen_orden) VALUES (?, ?, ?)`,
      [usuario_id, imagen_url, imagen_orden]
    );

    res.status(201).json({ message: 'Imagen temporal guardada exitosamente.', imagen_id: result.insertId, imagen_url });
  } catch (error) {
    console.error('Error al guardar imagen temporal:', error);
    res.status(500).json({ message: 'Error interno al guardar la imagen temporal.' });
  }
};

// Obtener imágenes temporales de un usuario
export const obtenerImagenesTemporales = async (req, res) => {
  const { usuario_id } = req.params;

  if (!usuario_id) {
    return res.status(400).json({ message: 'El ID del usuario es obligatorio.' });
  }

  try {
    const [imagenes] = await pool.query(
      `SELECT imagen_id, imagen_url, imagen_orden, fecha_subida 
       FROM imagenes_temporales 
       WHERE usuario_id = ? 
       ORDER BY imagen_orden ASC`,
      [usuario_id]
    );

    res.status(200).json(imagenes);
  } catch (error) {
    console.error('Error al obtener imágenes temporales:', error);
    res.status(500).json({ message: 'Error interno al obtener imágenes temporales.' });
  }
};

export const moverImagenTemporal = async (req, res) => {
  const { usuario_id, imagen_id, nuevo_orden } = req.body;

  if (!usuario_id || !imagen_id || nuevo_orden === undefined) {
    return res.status(400).json({ message: 'El usuario, la imagen y el nuevo orden son obligatorios.' });
  }

  try {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    // Obtener la imagen actual
    const [imagenActual] = await conn.query(
      `SELECT imagen_orden FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?`,
      [usuario_id, imagen_id]
    );

    if (imagenActual.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    const ordenActual = imagenActual[0].imagen_orden;

    // Si el nuevo orden es igual al actual, no hacer nada
    if (ordenActual === nuevo_orden) {
      await conn.rollback();
      return res.status(200).json({ message: 'El orden ya está actualizado.' });
    }

    // Ajustar los órdenes de las demás imágenes
    if (ordenActual < nuevo_orden) {
      // Mover hacia abajo: reducir el orden de las imágenes entre el rango
      await conn.query(
        `UPDATE imagenes_temporales 
         SET imagen_orden = imagen_orden - 1 
         WHERE usuario_id = ? AND imagen_orden > ? AND imagen_orden <= ?`,
        [usuario_id, ordenActual, nuevo_orden]
      );
    } else {
      // Mover hacia arriba: incrementar el orden de las imágenes entre el rango
      await conn.query(
        `UPDATE imagenes_temporales 
         SET imagen_orden = imagen_orden + 1 
         WHERE usuario_id = ? AND imagen_orden >= ? AND imagen_orden < ?`,
        [usuario_id, nuevo_orden, ordenActual]
      );
    }

    // Actualizar el orden de la imagen seleccionada
    await conn.query(
      `UPDATE imagenes_temporales 
       SET imagen_orden = ? 
       WHERE usuario_id = ? AND imagen_id = ?`,
      [nuevo_orden, usuario_id, imagen_id]
    );

    await conn.commit();
    res.status(200).json({ message: 'Orden de la imagen actualizado correctamente.' });
  } catch (error) {
    console.error('Error al mover imagen temporal:', error);
    res.status(500).json({ message: 'Error interno al mover la imagen.' });
  }
};

export const eliminarImagenTemporal = async (req, res) => {
  const { usuario_id, imagen_id } = req.body;

  if (!usuario_id || !imagen_id) {
    return res.status(400).json({ message: 'El usuario y la imagen son obligatorios.' });
  }

  try {
    const conn = await pool.getConnection();

    // Obtener la URL de la imagen desde la base de datos
    const [imagen] = await conn.query(
      `SELECT imagen_url FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?`,
      [usuario_id, imagen_id]
    );

    if (imagen.length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    const imagenUrl = imagen[0].imagen_url;

    // Eliminar la imagen de la base de datos
    await conn.query(`DELETE FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?`, [usuario_id, imagen_id]);

    // Eliminar la imagen del sistema de archivos
    const filePath = path.join('uploads', path.basename(imagenUrl));
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error al eliminar la imagen del sistema de archivos:', err);
      }
    });

    res.status(200).json({ message: 'Imagen eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imagen temporal:', error);
    res.status(500).json({ message: 'Error interno al eliminar la imagen.' });
  }
};

export const cancelarProcesoAltaProducto = async (req, res) => {
  const { usuario_id } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ message: 'El ID del usuario es obligatorio.' });
  }

  try {
    const conn = await pool.getConnection();

    // Obtener las URLs de las imágenes temporales asociadas al usuario
    const [imagenes] = await conn.query(
      `SELECT imagen_url FROM imagenes_temporales WHERE usuario_id = ?`,
      [usuario_id]
    );

    // Eliminar las imágenes de la base de datos
    await conn.query(`DELETE FROM imagenes_temporales WHERE usuario_id = ?`, [usuario_id]);

    // Eliminar las imágenes del sistema de archivos
    imagenes.forEach(({ imagen_url }) => {
      const filePath = path.join('uploads', path.basename(imagen_url));
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error al eliminar la imagen del sistema de archivos:', err);
        }
      });
    });

    res.status(200).json({ message: 'Proceso de alta cancelado correctamente.' });
  } catch (error) {
    console.error('Error al cancelar el proceso de alta:', error);
    res.status(500).json({ message: 'Error interno al cancelar el proceso de alta.' });
  }
};

export const obtenerProductos = async (req, res) => {
  const { estado } = req.query; // Obtener el estado desde la query

  try {
    let whereClause = '';
    if (estado === 'activos') {
      whereClause = `WHERE p.producto_estado = 'activo'`;
    } else if (estado === 'inactivos') {
      whereClause = `WHERE p.producto_estado = 'inactivo'`;
    } else if (estado === 'pendientes') {
      whereClause = `WHERE p.producto_estado = 'pendiente'`;
    }

    const [productos] = await pool.query(`
      SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        c.categoria_nombre AS categoria,
        COALESCE(SUM(s.cantidad), 0) AS stock_total,
        ip.imagen_url,
        p.producto_visible,
        p.producto_estado
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      LEFT JOIN stock s ON s.producto_id = p.producto_id OR s.variante_id IN (
        SELECT variante_id 
        FROM variantes 
        WHERE producto_id = p.producto_id
      )
      ${whereClause}
      GROUP BY p.producto_id, ip.imagen_url, c.categoria_nombre, p.producto_visible, p.producto_estado
      ORDER BY p.producto_nombre ASC
    `);

    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ message: 'Error interno al obtener productos.' });
  }
};

export const eliminarProducto = async (req, res) => {
  const { producto_id } = req.params;

  if (!producto_id) {
    return res.status(400).json({ message: 'El ID del producto es obligatorio.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE productos SET producto_estado = 'inactivo' WHERE producto_id = ?`,
      [producto_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    res.status(200).json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error interno al eliminar producto.' });
  }
};

export const cambiarVisibilidadProducto = async (req, res) => {
  const { producto_id, visible } = req.body;

  if (!producto_id || visible === undefined) {
    return res.status(400).json({ message: 'El ID del producto y el estado de visibilidad son obligatorios.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE productos SET producto_visible = ? WHERE producto_id = ?`,
      [visible, producto_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    res.status(200).json({ message: 'Visibilidad del producto actualizada correctamente.' });
  } catch (error) {
    console.error('Error al cambiar visibilidad del producto:', error);
    res.status(500).json({ message: 'Error interno al cambiar visibilidad del producto.' });
  }
};

export const reactivarProducto = async (req, res) => {
  const { producto_id } = req.params;

  if (!producto_id) {
    return res.status(400).json({ message: 'El ID del producto es obligatorio.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE productos SET producto_estado = 'activo' WHERE producto_id = ?`,
      [producto_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    res.status(200).json({ message: 'Producto reactivado correctamente.' });
  } catch (error) {
    console.error('Error al reactivar producto:', error);
    res.status(500).json({ message: 'Error interno al reactivar producto.' });
  }
};

export const obtenerDetallesStock = async (req, res) => {
  const { producto_id } = req.params;

  if (!producto_id) {
    return res.status(400).json({ message: 'El ID del producto es obligatorio.' });
  }

  try {
    // Obtener detalles del producto
    const [producto] = await pool.query(
      `SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        p.producto_sku,
        p.producto_descripcion,
        ip.imagen_url,
        COALESCE(SUM(s.cantidad), 0) AS stock_total
      FROM productos p
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      WHERE p.producto_id = ?
      GROUP BY p.producto_id, ip.imagen_url`
      , [producto_id]
    );

    if (producto.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    // Obtener detalles de las variantes (si existen)
    const [variantes] = await pool.query(
      `SELECT 
        v.variante_id,
        v.variante_precio_venta,
        v.variante_precio_oferta,
        v.variante_sku,
        v.variante_estado,
        COALESCE(s.cantidad, 0) AS stock_total,
        ip.imagen_url,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ?
      GROUP BY v.variante_id, ip.imagen_url, v.variante_estado`
      , [producto_id]
    );

    res.status(200).json({ producto: producto[0], variantes });
  } catch (error) {
    console.error('Error al obtener detalles de stock:', error);
    res.status(500).json({ message: 'Error interno al obtener detalles de stock.' });
  }
};


export const obtenerProductoPorId = async (req, res) => {
  const { producto_id } = req.params;

  if (!producto_id) {
    return res.status(400).json({ message: 'El ID del producto es obligatorio.' });
  }

  try {
    // Obtener los datos principales del producto
    const [productoRows] = await pool.query(
      `SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        p.producto_precio_costo,
        p.producto_sku,
        p.producto_descripcion,
        p.categoria_id,
        c.categoria_nombre,
        COALESCE(SUM(s.cantidad), 0) AS stock_total
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      WHERE p.producto_id = ?
      GROUP BY p.producto_id`,
      [producto_id]
    );

    if (productoRows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    const producto = productoRows[0];

    // Obtener las imágenes del producto
    const [imagenes] = await pool.query(
      `SELECT 
         ip.imagen_id, 
         ip.imagen_url, 
         ip.imagen_orden 
       FROM imagenes_productos ip 
       WHERE ip.producto_id = ? 
       ORDER BY ip.imagen_orden ASC`,
      [producto_id]
    );

    producto.imagenes = imagenes;

    // Obtener las variantes del producto
    const [variantesRaw] = await pool.query(
      `SELECT 
         v.variante_id,
         v.variante_precio_venta,
         v.variante_precio_oferta,
         v.variante_precio_costo,
         v.variante_sku,
         v.imagen_id,
         ip.imagen_url AS imagen_url,
         COALESCE(s.cantidad, 0) AS stock_total
       FROM variantes v
       LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
       LEFT JOIN stock s ON s.variante_id = v.variante_id
       WHERE v.producto_id = ?`,
      [producto_id]
    );

    // Obtener atributos de todas las variantes
    const [atributosRaw] = await pool.query(
      `SELECT 
         vv.variante_id,
         a.atributo_nombre,
         vv.valor_nombre
       FROM valores_variantes vv
       JOIN atributos a ON a.atributo_id = vv.atributo_id
       WHERE vv.variante_id IN (
         SELECT variante_id FROM variantes WHERE producto_id = ?
       )`,
      [producto_id]
    );

    // Armar un diccionario de atributos por variante
    const atributosPorVariante = {};
    for (const attr of atributosRaw) {
      if (!atributosPorVariante[attr.variante_id]) {
        atributosPorVariante[attr.variante_id] = [];
      }
      atributosPorVariante[attr.variante_id].push({
        atributo_nombre: attr.atributo_nombre,
        valor_nombre: attr.valor_nombre,
      });
    }

    // Mezclar los atributos con las variantes
    const variantes = variantesRaw.map((v) => ({
      ...v,
      atributos: atributosPorVariante[v.variante_id] || [],
    }));

    // Enviar la respuesta final
    res.status(200).json({
      producto,
      variantes,
    });

  } catch (error) {
    console.error('Error al obtener producto por ID:', error);
    res.status(500).json({ message: 'Error interno al obtener el producto.' });
  }
};


export const actualizarProducto = async (req, res) => {
  const { producto_id } = req.params;
  const {
    producto_nombre,
    categoria_id,
    producto_descripcion,
    producto_precio_venta,
    producto_precio_costo,
    producto_precio_oferta,
    producto_sku,
    producto_stock,
    imagenes,
    variantes,
  } = req.body;

  // Agregar depuración para ver los datos recibidos
  console.log('Datos recibidos en actualizarProducto:', {
    producto_id,
    producto_nombre,
    categoria_id,
    producto_descripcion,
    producto_precio_venta,
    producto_precio_costo,
    producto_precio_oferta,
    producto_sku,
    producto_stock,
    imagenes,
    variantes,
  });

  if (!producto_nombre || !categoria_id) {
    return res.status(400).json({ message: 'El nombre del producto y la categoría son obligatorios.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Actualizar los datos principales del producto
    const [producto] = await conn.query(`SELECT producto_estado FROM productos WHERE producto_id = ?`, [producto_id]);
    let nuevoEstadoProducto = producto[0].producto_estado;

    // Si se asigna un precio de venta y el estado es pendiente, cambiar a activo
    if (producto[0].producto_estado === 'pendiente' && producto_precio_venta !== null && producto_precio_venta !== undefined && producto_precio_venta > 0) {
      nuevoEstadoProducto = 'activo';
    } else if (producto_precio_venta !== null && producto_precio_venta !== undefined && producto_precio_venta > 0) {
      nuevoEstadoProducto = 'activo';
    }

    await conn.query(
      `UPDATE productos SET 
        producto_nombre = ?, 
        categoria_id = ?, 
        producto_descripcion = ?, 
        producto_precio_venta = ?, 
        producto_precio_costo = ?, 
        producto_precio_oferta = ?, 
        producto_sku = ?,
        producto_estado = ?
      WHERE producto_id = ?`,
      [
        producto_nombre,
        categoria_id,
        producto_descripcion || null,
        variantes && variantes.length > 0 ? null : producto_precio_venta || null, // Si hay variantes, precio venta es null
        variantes && variantes.length > 0 ? null : producto_precio_costo || null, // Si hay variantes, precio costo es null
        variantes && variantes.length > 0 ? null : producto_precio_oferta || null, // Si hay variantes, precio oferta es null
        variantes && variantes.length > 0 ? null : producto_sku || null, // Si hay variantes, SKU es null,
        nuevoEstadoProducto,
        producto_id,
      ]
    );

    // 2. Manejar el stock del producto principal
    const [stockExistenteProducto] = await conn.query(
      `SELECT stock_id FROM stock WHERE producto_id = ? AND variante_id IS NULL`,
      [producto_id]
    );

    if (variantes && variantes.length > 0) {
      // Si se agregaron variantes, establecer el precio y sku en null
      await conn.query(
        `UPDATE productos SET 
          producto_precio_venta = NULL, 
          producto_precio_costo = NULL, 
          producto_precio_oferta = NULL, 
          producto_sku = NULL 
        WHERE producto_id = ?`,
        [producto_id]
      );
      // Si se agregaron variantes, eliminar el stock del producto principal
      if (stockExistenteProducto.length > 0) {
        await conn.query(`UPDATE stock SET cantidad = 0 WHERE producto_id = ? AND variante_id IS NULL`, [producto_id]);
      } else {
        await conn.query(`INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`, [producto_id, 0]);
      }
    } else if (variantes && variantes.length === 0) {
      // Si se eliminaron todas las variantes, establecer el stock en 0 y los precios y SKU en null
      await conn.query(
        `UPDATE productos SET 
          producto_precio_venta = NULL, 
          producto_precio_costo = NULL, 
          producto_precio_oferta = NULL, 
          producto_sku = NULL 
        WHERE producto_id = ?`,
        [producto_id]
      );
      // Establecer el stock en 0
      if (stockExistenteProducto.length > 0) {
        await conn.query(
          `UPDATE stock SET cantidad = 0 WHERE producto_id = ? AND variante_id IS NULL`,
          [producto_id]
        );
      } else {
        await conn.query(
          `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
          [producto_id, 0]
        );
      }
    } else {
      // Si no hay variantes, actualizar el stock del producto principal
      let stockCantidad = 0; // Valor por defecto si no se proporciona producto_stock
      if (producto_stock !== undefined && producto_stock !== null) {
        stockCantidad = producto_stock; // Usar el valor proporcionado
      }

      if (stockExistenteProducto.length > 0) {
        // Si existe, actualizar el stock
        await conn.query(
          `UPDATE stock SET cantidad = ? WHERE producto_id = ? AND variante_id IS NULL`,
          [stockCantidad, producto_id]
        );
      } else {
        // Si no existe, insertar un nuevo registro de stock
        await conn.query(
          `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
          [producto_id, stockCantidad]
        );
      }
    }

    // 3. Actualizar imágenes del producto
    if (imagenes && imagenes.length > 0) {
      const imagenesValidas = imagenes.filter((imagen) => imagen.url && imagen.url.trim() !== '');

      if (imagenesValidas.length > 0) {
        await conn.query(`DELETE FROM imagenes_productos WHERE producto_id = ?`, [producto_id]);

        const imagenQueries = imagenesValidas.map((imagen, index) =>
          conn.query(
            `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) VALUES (?, ?, ?)`,
            [producto_id, imagen.url, index]
          )
        );
        await Promise.all(imagenQueries);
      }
    }

    // 4. Actualizar variantes
    if (variantes) {
      // 4.1 Eliminar variantes que no están en la lista enviada
      const varianteIdsEnviadas = variantes.map((variante) => variante.variante_id).filter((id) => id !== undefined);
      if (varianteIdsEnviadas.length > 0) {
        // Eliminar variantes
        await conn.query(
          `DELETE FROM variantes WHERE producto_id = ? AND variante_id NOT IN (?)`,
          [producto_id, varianteIdsEnviadas]
        );

        // Eliminar stock de las variantes eliminadas
        await conn.query(
          `DELETE FROM stock WHERE variante_id NOT IN (?) AND producto_id = ?`,
          [producto_id, varianteIdsEnviadas]
        );
      } else if (variantes.length === 0) {
        // Si se envió una lista vacía de variantes, eliminar todas las variantes del producto
        await conn.query(`DELETE FROM variantes WHERE producto_id = ?`, [producto_id]);
        // Si estoy modificando un producto que tiene variante. Y borro la variante. Debe insertarse en la tabla stock un registro (si no existeste previamente) para ese producto, en cero si no defino un stock y si defino un valor, debe tener ese valor.
        const [stockExistente] = await conn.query(
          `SELECT stock_id FROM stock WHERE producto_id = ? AND variante_id IS NULL`,
          [producto_id]
        );
        if (stockExistente.length > 0) {
          //en el caso de que este borrando una variante, y ese producto ya tiene un registro en stock, no debe borrarse, solo debe actualizarse con el valor de stock que le pase, si no la pasa nada, debe insertarse 0
          let stockCantidad = 0; // Valor por defecto si no se proporciona producto_stock
          if (producto_stock !== undefined && producto_stock !== null) {
            stockCantidad = producto_stock; // Usar el valor proporcionado
          }
          await conn.query(
            `UPDATE stock SET cantidad = ? WHERE producto_id = ? AND variante_id IS NULL`,
            [stockCantidad, producto_id]
          );
        } else {
          let stockCantidad = 0; // Valor por defecto si no se proporciona producto_stock
          if (producto_stock !== undefined && producto_stock !== null) {
            stockCantidad = producto_stock; // Usar el valor proporcionado
          }
          await conn.query(
            `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
            [producto_id, stockCantidad]
          );
        }
      }

      // 4.2 Insertar o actualizar las variantes enviadas
      if (variantes.length > 0) {
        for (const variante of variantes) {
          // Obtener el ID de la imagen asociada a la variante
          let imagen_id = null;
          if (variante.imagen_url) {
            const [imagenResult] = await conn.query(
              `SELECT imagen_id FROM imagenes_productos WHERE producto_id = ? AND imagen_url = ?`,
              [producto_id, variante.imagen_url]
            );
            if (imagenResult.length > 0) {
              imagen_id = imagenResult[0].imagen_id;
            }
          }

          let nuevoEstadoVariante = variante.variante_estado;
          if (variante.precio_venta !== null && variante.precio_venta !== undefined && variante.precio_venta > 0) {
            nuevoEstadoVariante = 'activo';
          }

          // Actualizar o insertar la variante
          if (variante.variante_id) {
            await conn.query(
              `UPDATE variantes SET 
                variante_precio_venta = ?, 
                variante_precio_costo = ?, 
                variante_precio_oferta = ?, 
                variante_sku = ?, 
                imagen_id = ? ,
                variante_estado = ?
              WHERE variante_id = ?`,
              [
                variante.precio_venta || null,
                variante.precio_costo || null,
                variante.precio_oferta || null,
                variante.sku || null,
                imagen_id,
                nuevoEstadoVariante,
                variante.variante_id,
              ]
            );
          } else {
            const [varianteResult] = await conn.query(
              `INSERT INTO variantes (
                producto_id, 
                imagen_id, 
                variante_precio_venta, 
                variante_precio_costo, 
                variante_precio_oferta, 
                variante_sku,
                variante_estado
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                producto_id,
                imagen_id,
                variante.precio_venta || null,
                variante.precio_costo || null,
                variante.precio_oferta || null,
                variante.sku || null,
                nuevoEstadoVariante,
              ]
            );
            variante.variante_id = varianteResult.insertId;
          }

          // Actualizar el stock de la variante
          if (variante.stock !== undefined) {
            const stockCantidad = variante.stock !== null ? variante.stock : 0;

            const [stockExistente] = await conn.query(
              `SELECT stock_id FROM stock WHERE variante_id = ?`,
              [variante.variante_id]
            );

            if (stockExistente.length > 0) {
              await conn.query(
                `UPDATE stock SET cantidad = ? WHERE variante_id = ?`,
                [stockCantidad, variante.variante_id]
              );
            } else {
              await conn.query(
                `INSERT INTO stock (variante_id, cantidad) VALUES (?, ?)`,
                [variante.variante_id, stockCantidad]
              );
            }
          }

          // Insertar valores asociados a la variante
          // Insertar valores asociados a la variante
          if (variante.valores && variante.valores.length > 0) {
            // Eliminar los valores existentes para evitar duplicados
            await conn.query(
              `DELETE FROM valores_variantes WHERE variante_id = ?`,
              [variante.variante_id]
            );

            for (const valor of variante.valores) {
              // Obtener el atributo_id correspondiente al atributo_nombre
              const [atributo] = await conn.query(
                `SELECT atributo_id FROM atributos WHERE producto_id = ? AND atributo_nombre = ?`,
                [producto_id, valor.atributo_nombre]
              );

              if (atributo.length > 0) {
                const atributo_id = atributo[0].atributo_id;

                // Insertar el nuevo valor
                await conn.query(
                  `INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)`,
                  [variante.variante_id, atributo_id, valor.valor_nombre]
                );
              } else {
                console.warn(`No se encontró el atributo '${valor.atributo_nombre}' para el producto ${producto_id}.`);
              }
            }
          }
        }
      }
    }

    await conn.commit();
    res.status(200).json({ message: 'Producto actualizado exitosamente.' });
  } catch (error) {
    await conn.rollback();
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error interno al actualizar el producto.' });
  } finally {
    conn.release();
  }
};

export const moverImagenProducto = async (req, res) => {
  const { producto_id, imagen_id, nuevo_orden } = req.body;
  console.log('Datos recibidos en moverImagenProducto:', req.body);

  if (!producto_id || !imagen_id || nuevo_orden === undefined) {
    return res.status(400).json({ message: 'El producto, la imagen y el nuevo orden son obligatorios.' });
  }

  try {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    // Obtener la imagen actual
    const [imagenActual] = await conn.query(
      `SELECT imagen_orden FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?`,
      [producto_id, imagen_id]
    );

    if (imagenActual.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    const ordenActual = imagenActual[0].imagen_orden;

    // Si el nuevo orden es igual al actual, no hacer nada
    if (ordenActual === nuevo_orden) {
      await conn.rollback();
      return res.status(200).json({ message: 'El orden ya está actualizado.' });
    }

    // Ajustar los órdenes de las demás imágenes
    if (ordenActual < nuevo_orden) {
      // Mover hacia abajo: reducir el orden de las imágenes entre el rango
      await conn.query(
        `UPDATE imagenes_productos 
         SET imagen_orden = imagen_orden - 1 
         WHERE producto_id = ? AND imagen_orden > ? AND imagen_orden <= ?`,
        [producto_id, ordenActual, nuevo_orden]
      );
    } else {
      // Mover hacia arriba: incrementar el orden de las imágenes entre el rango
      await conn.query(
        `UPDATE imagenes_productos 
         SET imagen_orden = imagen_orden + 1 
         WHERE producto_id = ? AND imagen_orden >= ? AND imagen_orden < ?`,
        [producto_id, nuevo_orden, ordenActual]
      );
    }

    // Actualizar el orden de la imagen seleccionada
    await conn.query(
      `UPDATE imagenes_productos 
       SET imagen_orden = ? 
       WHERE producto_id = ? AND imagen_id = ?`,
      [nuevo_orden, producto_id, imagen_id]
    );

    await conn.commit();
    res.status(200).json({ message: 'Orden de la imagen actualizado correctamente.' });
  } catch (error) {
    console.error('Error al mover imagen del producto:', error);
    res.status(500).json({ message: 'Error interno al mover la imagen.' });
  }
};

export const eliminarImagenProducto = async (req, res) => {
  const { producto_id, imagen_id } = req.params;

  console.log('Datos recibidos en eliminarImagenProducto CONTROLLER:', { producto_id, imagen_id });

  if (!producto_id || !imagen_id) {
    return res.status(400).json({ message: 'El producto y la imagen son obligatorios.' });
  }

  try {
    const conn = await pool.getConnection();

    // Obtener la URL de la imagen desde la base de datos
    const [imagen] = await conn.query(
      `SELECT imagen_url FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?`,
      [producto_id, imagen_id]
    );

    if (imagen.length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    const imagenUrl = imagen[0].imagen_url;

    // Eliminar la imagen de la base de datos
    await conn.query(`DELETE FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?`, [producto_id, imagen_id]);

    // Eliminar la imagen del sistema de archivos
    const filePath = path.join('uploads', path.basename(imagenUrl));
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error al eliminar la imagen del sistema de archivos:', err);
      }
    });

    res.status(200).json({ message: 'Imagen eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imagen del producto:', error);
    res.status(500).json({ message: 'Error interno al eliminar la imagen.' });
  }
};

export const subirImagenProducto = async (req, res) => {
  const { producto_id } = req.params;

  if (!producto_id || !req.file) {
    return res.status(400).json({ message: 'El producto y la imagen son obligatorios.' });
  }

  const imagen_url = `/uploads/${req.file.filename}`; // Ruta relativa de la imagen subida

  try {
    const [result] = await pool.query(
      `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) 
       SELECT ?, ?, IFNULL(MAX(imagen_orden), -1) + 1 FROM imagenes_productos WHERE producto_id = ?`,
      [producto_id, imagen_url, producto_id]
    );

    res.status(201).json({ 
      message: 'Imagen subida exitosamente.', 
      imagen_id: result.insertId, 
      imagen_url 
    });
  } catch (error) {
    console.error('Error al subir imagen del producto:', error);
    res.status(500).json({ message: 'Error interno al subir la imagen.' });
  }
};

export const eliminarImagenesNuevas = async (req, res) => {
  const { producto_id, imagenes } = req.body;

  if (!producto_id || !imagenes || !Array.isArray(imagenes)) {
    return res.status(400).json({ message: 'El producto y las imágenes son obligatorios.' });
  }

  if (imagenes.length === 0) {
    return res.status(200).json({ message: 'No hay imágenes nuevas para eliminar.' });
  }

  try {
    const conn = await pool.getConnection();

    // Obtener las URLs de las imágenes para borrarlas del sistema de archivos
    const [urls] = await conn.query(
      `SELECT imagen_url FROM imagenes_productos WHERE producto_id = ? AND imagen_id IN (?)`,
      [producto_id, imagenes]
    );

    // Eliminar las imágenes de la base de datos
    await conn.query(`DELETE FROM imagenes_productos WHERE producto_id = ? AND imagen_id IN (?)`, [producto_id, imagenes]);

    // Eliminar las imágenes del sistema de archivos
    urls.forEach(({ imagen_url }) => {
      const filePath = path.join('uploads', path.basename(imagen_url));
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error al eliminar la imagen del sistema de archivos:', err);
      });
    });

    res.status(200).json({ message: 'Imágenes nuevas eliminadas correctamente.' });
  } catch (error) {
    console.error('Error al eliminar imágenes nuevas:', error);
    res.status(500).json({ message: 'Error interno al eliminar las imágenes.' });
  }
};

export const verificarVentasVariante = async (req, res) => {
  const { variante_id } = req.params;

  if (!variante_id) {
    return res.status(400).json({ message: 'El ID de la variante es obligatorio.' });
  }

  try {
    const [result] = await pool.query(
      `SELECT COUNT(*) AS total FROM ventas_detalle WHERE vd_variante_id = ?`,
      [variante_id]
    );

    const tieneVentas = result[0].total > 0;
    res.status(200).json({ tieneVentas });
  } catch (error) {
    console.error('Error al verificar ventas de variante:', error);
    res.status(500).json({ message: 'Error interno al verificar ventas.' });
  }
};

export const cambiarEstadoVariante = async (req, res) => {
  const { variante_id, estado } = req.body;

  if (!variante_id || !['activo', 'inactivo'].includes(estado)) {
    return res.status(400).json({ message: 'Datos inválidos: se requiere variante_id y un estado válido.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE variantes SET variante_estado = ? WHERE variante_id = ?`,
      [estado, variante_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Variante no encontrada.' });
    }

    res.status(200).json({ message: `Variante ${estado === 'activo' ? 'activada' : 'deshabilitada'} correctamente.` });
  } catch (error) {
    console.error('Error al cambiar estado de variante:', error);
    res.status(500).json({ message: 'Error interno al actualizar estado de variante.' });
  }
};
