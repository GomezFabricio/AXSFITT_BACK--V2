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
    producto_stock,
    producto_sku,
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
        producto_stock,
        producto_estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
      [
        categoria_id,
        producto_nombre,
        producto_descripcion || null,
        producto_precio_venta || null,
        producto_precio_costo || null,
        producto_precio_oferta || null,
        producto_sku || null,
        producto_stock || null,
      ]
    );
    const producto_id = productoResult.insertId;

    // 2. Mover imágenes de la tabla temporal a la definitiva
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

    // 3. Insertar atributos y valores
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

    // 4. Insertar variantes
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
            precio_venta,
            precio_costo,
            precio_oferta,
            stock,
            sku
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            producto_id,
            imagen_id,
            variante.precio_venta,
            variante.precio_costo || null,
            variante.precio_oferta || null,
            variante.stock || null,
            variante.sku || null,
          ]
        );
        const variante_id = varianteResult.insertId;

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
  const { usuario_id, imagen_url, imagen_orden } = req.body;

  if (!usuario_id || !imagen_url) {
    return res.status(400).json({ message: 'El usuario y la URL de la imagen son obligatorios.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO imagenes_temporales (usuario_id, imagen_url, imagen_orden) VALUES (?, ?, ?)`,
      [usuario_id, imagen_url, imagen_orden]
    );

    res.status(201).json({ message: 'Imagen temporal guardada exitosamente.', imagen_id: result.insertId });
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