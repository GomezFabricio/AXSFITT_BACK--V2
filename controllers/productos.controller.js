import { pool } from '../db.js';

// Función para dar de alta un producto con atributos y variantes
export const crearProducto = async (req, res) => {
  const {
    usuario_id, // ID del usuario que está realizando la operación
    producto_nombre,
    categoria_id,
    producto_descripcion,
    producto_precio_venta,
    producto_precio_costo,
    producto_precio_oferta,
    producto_sku,
    producto_stock, // Stock inicial del producto
    imagenes, // Array de URLs de imágenes con orden
    atributos, // Array de objetos { atributo_nombre, valores: [valor1, valor2, ...] }
    variantes, // Array de objetos { precio_venta, precio_costo, precio_oferta, stock, sku, imagen_url, valores }
  } = req.body;

  if (!producto_nombre || !categoria_id) {
    return res.status(400).json({ message: 'El nombre del producto y la categoría son obligatorios.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

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
        producto_estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')`,
      [
        categoria_id,
        producto_nombre,
        producto_descripcion || null,
        producto_precio_venta || null,
        producto_precio_costo || null,
        producto_precio_oferta || null,
        producto_sku || null,
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
    const imagenIdMap = {};
    if (imagenes && imagenes.length > 0) {
      const imagenQueries = imagenes.map((url, index) =>
        conn.query(
          `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden)
           SELECT ?, imagen_url, imagen_orden
           FROM imagenes_temporales
           WHERE usuario_id = ? AND imagen_url = ?`,
          [producto_id, usuario_id, url]
        )
      );
      const imagenResults = await Promise.all(imagenQueries);

      // Mapear URLs a IDs
      imagenResults.forEach((result, index) => {
        imagenIdMap[imagenes[index]] = result.insertId;
      });

      // Eliminar las imágenes de la tabla temporal
      await conn.query(`DELETE FROM imagenes_temporales WHERE usuario_id = ?`, [usuario_id]);
    }

    // 4. Insertar atributos y valores
    const atributoIds = {};
    if (atributos && atributos.length > 0) {
      for (const atributo of atributos) {
        const [atributoResult] = await conn.query(
          `INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)`,
          [producto_id, atributo.atributo_nombre]
        );
        const atributo_id = atributoResult.insertId;
        atributoIds[atributo.atributo_nombre] = atributo_id;

        // Insertar valores del atributo
        const valorQueries = atributo.valores.map(valor =>
          conn.query(
            `INSERT INTO valores_atributo (atributo_id, valor_nombre) VALUES (?, ?)`,
            [atributo_id, valor]
          )
        );
        await Promise.all(valorQueries);
      }
    }

    // 5. Insertar variantes
    if (variantes && variantes.length > 0) {
      for (const variante of variantes) {
        // Obtener imagen_id asociado a la variante
        let imagen_id = null;
        if (variante.imagen_url) {
          imagen_id = imagenIdMap[variante.imagen_url] || null;
        }

        // Insertar variante
        const [varianteResult] = await conn.query(
          `INSERT INTO variantes (
            producto_id,
            imagen_id,
            variante_precio_venta,
            variante_precio_costo,
            variante_precio_oferta,
            variante_sku
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            producto_id,
            imagen_id,
            variante.precio_venta,
            variante.precio_costo || null,
            variante.precio_oferta || null,
            variante.sku || null,
          ]
        );
        const variante_id = varianteResult.insertId;

        // Insertar el stock de la variante
        if (variante.stock) {
          await conn.query(
            `INSERT INTO stock (variante_id, cantidad) VALUES (?, ?)`,
            [variante_id, variante.stock]
          );
        }

        // Insertar valores asociados a la variante
        const valorQueries = variante.valores.map(valor_nombre => {
          const atributo_nombre = Object.keys(atributoIds).find(nombre =>
            atributos.some(attr => attr.atributo_nombre === nombre && attr.valores.includes(valor_nombre))
          );
          const atributo_id = atributoIds[atributo_nombre];
          return conn.query(
            `INSERT INTO valores_variantes (variante_id, valor_id) 
             SELECT ?, valor_id FROM valores_atributo WHERE atributo_id = ? AND valor_nombre = ?`,
            [variante_id, atributo_id, valor_nombre]
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