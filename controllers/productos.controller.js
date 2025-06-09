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
  try {
    const [productos] = await pool.query(`
      SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        c.categoria_nombre AS categoria,
        COALESCE(SUM(s.cantidad), 0) AS stock_total,
        ip.imagen_url,
        p.producto_visible
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
      WHERE p.producto_estado = 'pendiente'
      GROUP BY p.producto_id, ip.imagen_url, c.categoria_nombre, p.producto_visible
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
      GROUP BY v.variante_id, ip.imagen_url`
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
    // Obtener detalles del producto
    const [producto] = await pool.query(
      `SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        p.producto_precio_costo,
        p.producto_sku,
        p.producto_descripcion,
        p.categoria_id,
        COALESCE(SUM(s.cantidad), 0) AS stock_total,
        ip.imagen_id AS imagen_id,
        ip.imagen_url
      FROM productos p
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      WHERE p.producto_id = ?
      GROUP BY p.producto_id, ip.imagen_id, ip.imagen_url`
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
        v.variante_precio_costo,
        v.variante_sku,
        COALESCE(s.cantidad, 0) AS stock_total,
        ip.imagen_id AS imagen_id,
        ip.imagen_url,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ?
      GROUP BY v.variante_id, ip.imagen_id, ip.imagen_url`
      , [producto_id]
    );

    res.status(200).json({ producto: producto[0], variantes });
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

  if (!producto_nombre || !categoria_id) {
    return res.status(400).json({ message: 'El nombre del producto y la categoría son obligatorios.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Actualizar el producto
    await conn.query(
      `UPDATE productos SET 
        producto_nombre = ?, 
        categoria_id = ?, 
        producto_descripcion = ?, 
        producto_precio_venta = ?, 
        producto_precio_costo = ?, 
        producto_precio_oferta = ?, 
        producto_sku = ? 
      WHERE producto_id = ?`,
      [
        producto_nombre,
        categoria_id,
        producto_descripcion || null,
        producto_precio_venta || null,
        producto_precio_costo || null,
        producto_precio_oferta || null,
        producto_sku || null,
        producto_id,
      ]
    );

    // Actualizar el stock del producto
    if (producto_stock !== undefined) {
      await conn.query(
        `UPDATE stock SET cantidad = ? WHERE producto_id = ?`,
        [producto_stock, producto_id]
      );
    }

    // Actualizar imágenes del producto
    if (imagenes && imagenes.length > 0) {
      await conn.query(`DELETE FROM imagenes_productos WHERE producto_id = ?`, [producto_id]);

      const imagenQueries = imagenes.map((imagen, index) =>
        conn.query(
          `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) VALUES (?, ?, ?)`,
          [producto_id, imagen.imagen_url, index]

        )
      );
      await Promise.all(imagenQueries);
    }

    // Actualizar variantes
    if (variantes && variantes.length > 0) {
      for (const variante of variantes) {
        await conn.query(
          `UPDATE variantes SET 
            variante_precio_venta = ?, 
            variante_precio_costo = ?, 
            variante_precio_oferta = ?, 
            variante_sku = ? 
          WHERE variante_id = ?`,
          [
            variante.precio_venta || null,
            variante.precio_costo || null,
            variante.precio_oferta || null,
            variante.sku || null,
            variante.variante_id,
          ]
        );

        // Actualizar stock de la variante
        if (variante.stock !== undefined) {
          await conn.query(
            `UPDATE stock SET cantidad = ? WHERE variante_id = ?`,
            [variante.stock, variante.variante_id]
          );
        }

        // Actualizar imagen de la variante
        if (variante.imagen_id) {
          await conn.query(
            `UPDATE variantes SET imagen_id = ? WHERE variante_id = ?`,
            [variante.imagen_id, variante.variante_id]
          );
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

