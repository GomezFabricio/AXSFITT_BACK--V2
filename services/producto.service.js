import { pool } from '../db.js';
import fs from 'fs';
import path from 'path';

/**
 * Servicio para la gestión de productos
 * Maneja toda la lógica de negocio relacionada con productos
 */
class ProductoService {
  /**
   * Obtiene todos los productos con sus detalles
   * @param {string} estado - Estado de los productos a filtrar (activos, inactivos, pendientes)
   * @returns {Array} Lista de productos
   */
  static async obtenerTodosLosProductos(estado = null) {
    let whereClause = `WHERE 1 = 1`; // Mostrar todos los productos por defecto
    
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
        p.producto_visible AS visible,
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

    // Fetch variants for each product like the original controller
    for (const producto of productos) {
      const [variantes] = await pool.query(`
        SELECT 
          v.variante_id,
          v.variante_sku,
          COALESCE(s.cantidad, 0) AS stock_total,
          ip.imagen_url,
          vv.valor_nombre,
          a.atributo_nombre,
          v.variante_estado
        FROM variantes v
        LEFT JOIN stock s ON s.variante_id = v.variante_id
        LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
        LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
        LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
        WHERE v.producto_id = ? AND v.variante_estado = 'activo'
      `, [producto.producto_id]);
      producto.variantes = variantes;
    }
    
    return productos;
  }

  /**
   * Obtiene un producto por ID con todos sus detalles
   * @param {number} id - ID del producto
   * @returns {Object|null} Producto completo o null si no existe
   */
  static async obtenerProductoPorId(id) {
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
      [id]
    );

    if (productoRows.length === 0) {
      return null;
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
      [id]
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
      [id]
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
      [id]
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
    return {
      producto,
      variantes,
    };
  }

  /**
   * Verifica si existe un producto con el mismo nombre en la misma categoría
   * @param {string} nombre - Nombre del producto
   * @param {number} categoriaId - ID de la categoría
   * @param {number} productoIdExcluir - ID del producto a excluir (para edición)
   * @returns {boolean} true si existe duplicado
   */
  static async verificarNombreDuplicado(nombre, categoriaId, productoIdExcluir = null) {
    const query = productoIdExcluir
      ? 'SELECT producto_id FROM productos WHERE producto_nombre = ? AND categoria_id = ? AND producto_id != ? AND producto_estado != "eliminado"'
      : 'SELECT producto_id FROM productos WHERE producto_nombre = ? AND categoria_id = ? AND producto_estado != "eliminado"';
    
    const params = productoIdExcluir
      ? [nombre, categoriaId, productoIdExcluir]
      : [nombre, categoriaId];

    const [result] = await pool.query(query, params);
    return result.length > 0;
  }

  /**
   * Verifica si existe un producto con el mismo SKU
   * @param {string} sku - SKU del producto
   * @param {number} productoIdExcluir - ID del producto a excluir (para edición)
   * @returns {boolean} true si existe duplicado
   */
  static async verificarSkuDuplicado(sku, productoIdExcluir = null) {
    if (!sku) return false; // Si no hay SKU, no hay duplicado

    const query = productoIdExcluir
      ? 'SELECT producto_id FROM productos WHERE producto_sku = ? AND producto_id != ? AND producto_estado != "eliminado"'
      : 'SELECT producto_id FROM productos WHERE producto_sku = ? AND producto_estado != "eliminado"';
    
    const params = productoIdExcluir
      ? [sku, productoIdExcluir]
      : [sku];

    const [result] = await pool.query(query, params);
    return result.length > 0;
  }

  /**
   * Busca productos por nombre parcial para autocomplete
   * @param {string} nombre - Nombre parcial del producto
   * @param {number} categoriaId - ID de la categoría (opcional)
   * @returns {Array} Lista de productos que coinciden
   */
  static async buscarProductosPorNombre(nombre, categoriaId = null) {
    let query = `
      SELECT 
        p.producto_id,
        p.producto_nombre,
        p.categoria_id,
        c.categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      WHERE p.producto_nombre LIKE ? AND p.producto_estado != 'eliminado'
    `;
    
    const params = [`%${nombre}%`];
    
    if (categoriaId) {
      query += ' AND p.categoria_id = ?';
      params.push(categoriaId);
    }
    
    query += ' ORDER BY p.producto_nombre ASC LIMIT 10';

    const [productos] = await pool.query(query, params);
    return productos;
  }

  /**
   * Crea un nuevo producto
   * @param {Object} datos - Datos del producto
   * @returns {Object} Producto creado
   */
  static async crearProducto(datos) {
    console.log('🔄 ProductoService.crearProducto - Datos recibidos:', datos);
    
    const {
      usuario_id,
      categoria_id,
      producto_nombre,
      producto_descripcion,
      producto_precio_venta,
      producto_precio_costo,
      producto_precio_oferta,
      producto_sku,
      producto_stock,
      imagenes,
      atributos,
      variantes
    } = datos;

    console.log('🔄 usuario_id extraído:', usuario_id);

    // Validar duplicados
    const nombreDuplicado = await this.verificarNombreDuplicado(producto_nombre, categoria_id);
    if (nombreDuplicado) {
      throw new Error('Ya existe un producto con ese nombre en la misma categoría');
    }

    if (producto_sku) {
      const skuDuplicado = await this.verificarSkuDuplicado(producto_sku);
      if (skuDuplicado) {
        throw new Error('Ya existe un producto con ese SKU');
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Determinar el estado del producto
      let producto_estado = 'pendiente';
      
      if (variantes && variantes.length > 0) {
        const tieneVarianteConPrecio = variantes.some(variante => 
          variante.precio_venta && parseFloat(variante.precio_venta) > 0
        );
        producto_estado = tieneVarianteConPrecio ? 'activo' : 'pendiente';
      } else {
        producto_estado = producto_precio_venta ? 'activo' : 'pendiente';
      }

      // Insertar el producto
      const [productoResult] = await conn.query(`
        INSERT INTO productos (
          categoria_id,
          producto_nombre,
          producto_descripcion,
          producto_precio_venta,
          producto_precio_costo,
          producto_precio_oferta,
          producto_sku,
          producto_estado,
          producto_visible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        categoria_id,
        producto_nombre,
        producto_descripcion || null,
        producto_precio_venta || null,
        producto_precio_costo || null,
        producto_precio_oferta || null,
        producto_sku || null,
        producto_estado,
        true
      ]);

      const producto_id = productoResult.insertId;
      console.log('✅ Producto insertado con ID:', producto_id);

      // Insertar stock inicial si existe
      if (producto_stock) {
        await conn.query(
          'INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)',
          [producto_id, producto_stock]
        );
        console.log('✅ Stock inicial insertado:', producto_stock);
      }

      // Procesar imágenes temporales
      if (imagenes && imagenes.length > 0) {
        console.log('🔄 Procesando imágenes temporales:', imagenes.length);
        
        const imagenQueries = imagenes.map((imagen, index) => {
          console.log('🔄 Procesando imagen:', { 
            id: imagen.id, 
            index, 
            usuario_id: datos.usuario_id || usuario_id,
            producto_id 
          });
          return conn.query(
            `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden)
            SELECT ?, imagen_url, ?
            FROM imagenes_temporales
            WHERE usuario_id = ? AND imagen_id = ?`,
            [producto_id, index, datos.usuario_id || usuario_id, imagen.id]
          );
        });
        
        await Promise.all(imagenQueries);
        console.log('✅ Imágenes procesadas exitosamente');

        // Eliminar las imágenes de la tabla temporal
        await conn.query(`DELETE FROM imagenes_temporales WHERE usuario_id = ?`, [datos.usuario_id || usuario_id]);
        console.log('✅ Imágenes temporales eliminadas para usuario_id:', datos.usuario_id || usuario_id);
      }

      // Procesar atributos
      const atributoIds = {};
      if (atributos && atributos.length > 0) {
        console.log('🔄 Procesando atributos:', atributos.length);
        
        for (const atributo of atributos) {
          const [atributoResult] = await conn.query(
            `INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)`,
            [producto_id, atributo.atributo_nombre]
          );
          const atributo_id = atributoResult.insertId;
          atributoIds[atributo.atributo_nombre] = atributo_id;
          console.log('✅ Atributo insertado:', { nombre: atributo.atributo_nombre, id: atributo_id });
        }
      }

      // Procesar variantes
      if (variantes && variantes.length > 0) {
        console.log('🔄 Procesando variantes:', variantes.length);
        
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
              console.log('✅ Imagen encontrada para variante:', { url: variante.imagen_url, id: imagen_id });
            } else {
              console.log('⚠️ No se encontró imagen_id para la URL:', variante.imagen_url);
            }
          }

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
          console.log('✅ Variante insertada:', { id: variante_id, estado: variante_estado });

          // Insertar stock de la variante (si tiene stock inicial)
          if (variante.stock) {
            await conn.query(
              `INSERT INTO stock (variante_id, cantidad) VALUES (?, ?)`,
              [variante_id, variante.stock]
            );
            console.log('✅ Stock de variante insertado:', variante.stock);
          }

          // Insertar valores asociados a la variante
          if (variante.valores && variante.valores.length > 0) {
            console.log('🔄 Procesando valores de variante:', variante.valores);
            
            for (const valor of variante.valores) {
              // Buscar el atributo correspondiente
              const atributo_nombre = Object.keys(atributoIds).find(nombre =>
                atributos.some(attr => attr.atributo_nombre === nombre)
              );

              if (!atributo_nombre) {
                throw new Error(`No se encontró el atributo relacionado con el valor: ${valor}`);
              }

              const atributo_id = atributoIds[atributo_nombre];

              await conn.query(
                `INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)`,
                [variante_id, atributo_id, valor]
              );
              console.log('✅ Valor de variante insertado:', { valor, atributo_id });
            }
          }
        }
      }

      await conn.commit();
      return {
        producto_id,
        producto_estado
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualiza un producto existente
   * @param {number} id - ID del producto
   * @param {Object} datos - Datos a actualizar
   * @returns {boolean} true si se actualizó, false si no se encontró
   */
  static async actualizarProducto(id, datos) {
    const {
      categoria_id,
      producto_nombre,
      producto_descripcion,
      producto_precio_venta,
      producto_precio_costo,
      producto_precio_oferta,
      producto_sku
    } = datos;

    // Verificar que el producto existe
    const [productoExistente] = await pool.query(
      'SELECT producto_id FROM productos WHERE producto_id = ? AND producto_estado != "eliminado"',
      [id]
    );

    if (productoExistente.length === 0) {
      return false;
    }

    // Validar duplicados
    const nombreDuplicado = await this.verificarNombreDuplicado(producto_nombre, categoria_id, id);
    if (nombreDuplicado) {
      throw new Error('Ya existe un producto con ese nombre en la misma categoría');
    }

    if (producto_sku) {
      const skuDuplicado = await this.verificarSkuDuplicado(producto_sku, id);
      if (skuDuplicado) {
        throw new Error('Ya existe un producto con ese SKU');
      }
    }

    const [result] = await pool.query(`
      UPDATE productos 
      SET categoria_id = ?, 
          producto_nombre = ?, 
          producto_descripcion = ?, 
          producto_precio_venta = ?, 
          producto_precio_costo = ?, 
          producto_precio_oferta = ?, 
          producto_sku = ?
      WHERE producto_id = ?
    `, [
      categoria_id,
      producto_nombre,
      producto_descripcion || null,
      producto_precio_venta || null,
      producto_precio_costo || null,
      producto_precio_oferta || null,
      producto_sku || null,
      id
    ]);

    return result.affectedRows > 0;
  }

  /**
   * Actualiza un producto existente siguiendo la lógica del controlador original
   * @param {number} id - ID del producto
   * @param {Object} datos - Datos a actualizar
   * @returns {boolean} true si se actualizó correctamente
   */
  static async actualizarProductoCompleto(id, datos) {
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
    } = datos;

    if (!producto_nombre || !categoria_id) {
      throw new Error('El nombre del producto y la categoría son obligatorios.');
    }

    console.log('ProductoService.actualizarProductoCompleto - Datos recibidos:', {
      producto_stock,
      tipo_producto_stock: typeof producto_stock,
      variantes: variantes ? variantes.length : 'undefined'
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Actualizar los datos principales del producto
      const [producto] = await conn.query(`SELECT producto_estado FROM productos WHERE producto_id = ?`, [id]);
      if (producto.length === 0) {
        throw new Error('Producto no encontrado');
      }
      
      let nuevoEstadoProducto = producto[0].producto_estado;

      // Si el producto tiene variantes, verificamos si al menos una tiene precio de venta
      if (variantes && variantes.length > 0) {
        const tieneVarianteConPrecio = variantes.some(variante => 
          variante.precio_venta !== null && variante.precio_venta !== undefined && parseFloat(variante.precio_venta) > 0
        );
        
        if (tieneVarianteConPrecio) {
          nuevoEstadoProducto = 'activo';
        }
      }
      // Si no tiene variantes y tiene precio de venta, también será activo
      else if (producto_precio_venta !== null && producto_precio_venta !== undefined && parseFloat(producto_precio_venta) > 0) {
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
          variantes && variantes.length > 0 ? null : producto_precio_venta,
          variantes && variantes.length > 0 ? null : producto_precio_costo,
          variantes && variantes.length > 0 ? null : producto_precio_oferta,
          variantes && variantes.length > 0 ? null : producto_sku,
          nuevoEstadoProducto,
          id,
        ]
      );

      // 2. Manejar el stock del producto principal
      const [stockExistenteProducto] = await conn.query(
        `SELECT stock_id FROM stock WHERE producto_id = ? AND variante_id IS NULL`,
        [id]
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
          [id]
        );
        // Si se agregaron variantes, eliminar el stock del producto principal
        if (stockExistenteProducto.length > 0) {
          await conn.query(`UPDATE stock SET cantidad = 0 WHERE producto_id = ? AND variante_id IS NULL`, [id]);
        } else {
          await conn.query(`INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`, [id, 0]);
        }
      } else if (variantes && variantes.length === 0) {
        // Si se eliminaron todas las variantes, actualizar con los valores proporcionados
        await conn.query(
          `UPDATE productos SET 
            producto_precio_venta = ?, 
            producto_precio_costo = ?, 
            producto_precio_oferta = ?, 
            producto_sku = ? 
          WHERE producto_id = ?`,
          [
            producto_precio_venta,
            producto_precio_costo,
            producto_precio_oferta,
            producto_sku,
            id
          ]
        );
        
        // Establecer el stock 
        let stockCantidad = 0; // Valor por defecto si no se proporciona producto_stock
        if (producto_stock !== undefined && producto_stock !== null) {
          stockCantidad = producto_stock; // Usar el valor proporcionado
        }
        
        if (stockExistenteProducto.length > 0) {
          await conn.query(
            `UPDATE stock SET cantidad = ? WHERE producto_id = ? AND variante_id IS NULL`,
            [stockCantidad, id]
          );
        } else {
          await conn.query(
            `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
            [id, stockCantidad]
          );
        }
      } else {
        // Si no hay variantes, actualizar el stock del producto principal
        let stockCantidad = 0; // Valor por defecto si no se proporciona producto_stock
        if (producto_stock !== undefined && producto_stock !== null) {
          stockCantidad = producto_stock; // Usar el valor proporcionado
        }

        console.log('Actualizando stock del producto principal:', {
          producto_stock,
          stockCantidad,
          stockExistente: stockExistenteProducto.length > 0
        });

        if (stockExistenteProducto.length > 0) {
          // Si existe, actualizar el stock
          await conn.query(
            `UPDATE stock SET cantidad = ? WHERE producto_id = ? AND variante_id IS NULL`,
            [stockCantidad, id]
          );
          console.log('Stock actualizado en registro existente');
        } else {
          // Si no existe, insertar un nuevo registro de stock
          await conn.query(
            `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
            [id, stockCantidad]
          );
          console.log('Nuevo registro de stock insertado');
        }
      }

      
      // 3. Actualizar imágenes del producto
      if (imagenes && imagenes.length > 0) {
        const imagenesValidas = imagenes.filter((imagen) => imagen.url && imagen.url.trim() !== '');

        if (imagenesValidas.length > 0) {
          await conn.query(`DELETE FROM imagenes_productos WHERE producto_id = ?`, [id]);

          const imagenQueries = imagenesValidas.map((imagen, index) =>
            conn.query(
              `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) VALUES (?, ?, ?)`,
              [id, imagen.url, index]
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
            [id, varianteIdsEnviadas]
          );

          // Eliminar stock de las variantes eliminadas
          await conn.query(
            `DELETE FROM stock WHERE variante_id NOT IN (?) AND producto_id = ?`,
            [varianteIdsEnviadas, id]
          );
        } else if (variantes.length === 0) {
          // Si se envió una lista vacía de variantes, eliminar todas las variantes del producto
          await conn.query(`DELETE FROM variantes WHERE producto_id = ?`, [id]);
          
          // Si estoy modificando un producto que tiene variante. Y borro la variante. Debe insertarse en la tabla stock un registro (si no existeste previamente) para ese producto
          const [stockExistente] = await conn.query(
            `SELECT stock_id FROM stock WHERE producto_id = ? AND variante_id IS NULL`,
            [id]
          );
          
          let stockCantidad = 0; // Valor por defecto si no se proporciona producto_stock
          if (producto_stock !== undefined && producto_stock !== null) {
            stockCantidad = producto_stock; // Usar el valor proporcionado
          }
          
          if (stockExistente.length > 0) {
            //en el caso de que este borrando una variante, y ese producto ya tiene un registro en stock, no debe borrarse, solo debe actualizarse con el valor de stock que le pase
            await conn.query(
              `UPDATE stock SET cantidad = ? WHERE producto_id = ? AND variante_id IS NULL`,
              [stockCantidad, id]
            );
          } else {
            await conn.query(
              `INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)`,
              [id, stockCantidad]
            );
          }
        }

        // 4.2 Insertar o actualizar las variantes enviadas
        if (variantes.length > 0) {
          // Primero, recolectamos todos los nombres de atributos únicos de todas las variantes
          const atributosUnicos = new Set();
          for (const variante of variantes) {
            if (variante.valores && Array.isArray(variante.valores)) {
              for (const valor of variante.valores) {
                atributosUnicos.add(valor.atributo_nombre);
              }
            }
          }

          // Luego, insertamos los atributos si no existen
          const atributoIds = {};
          for (const atributo_nombre of atributosUnicos) {
            // Verificar si el atributo ya existe para este producto
            const [atributoExistente] = await conn.query(
              `SELECT atributo_id FROM atributos WHERE producto_id = ? AND atributo_nombre = ?`,
              [id, atributo_nombre]
            );

            if (atributoExistente.length > 0) {
              // Si el atributo ya existe, usar su ID
              atributoIds[atributo_nombre] = atributoExistente[0].atributo_id;
            } else {
              // Si el atributo no existe, insertarlo
              const [atributoResult] = await conn.query(
                `INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)`,
                [id, atributo_nombre]
              );
              atributoIds[atributo_nombre] = atributoResult.insertId;
            }
          }

          // Ahora que todos los atributos están insertados, podemos insertar las variantes
          for (const variante of variantes) {
            // Obtener el ID de la imagen asociada a la variante
            let imagen_id = null;
            if (variante.imagen_url) {
              const [imagenResult] = await conn.query(
                `SELECT imagen_id FROM imagenes_productos WHERE producto_id = ? AND imagen_url = ?`,
                [id, variante.imagen_url]
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
            let varianteResult;
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
              varianteResult = { insertId: variante.variante_id }; // Simulamos el resultado para mantener la lógica
            } else {
              [varianteResult] = await conn.query(
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
                  id,
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
            if (variante.valores && Array.isArray(variante.valores)) {
              // AGREGAR ESTA LÍNEA: Eliminar los valores anteriores para esta variante
              await conn.query(
                `DELETE FROM valores_variantes WHERE variante_id = ?`,
                [varianteResult.insertId]
              );

              for (const valor of variante.valores) {
                const atributo_nombre = valor.atributo_nombre;

                if (!atributoIds[atributo_nombre]) {
                  console.warn(`No se encontró el atributo '${atributo_nombre}' para el producto ${id}.`);
                  continue;
                }

                const atributo_id = atributoIds[atributo_nombre];

                // Insertar el nuevo valor
                try {
                  await conn.query(
                    `INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)`,
                    [varianteResult.insertId, atributo_id, valor.valor_nombre]
                  );
                } catch (innerError) {
                  if (innerError.code === 'ER_DUP_ENTRY') {
                    console.warn(`Intento de insertar valor duplicado para variante_id ${varianteResult.insertId} y atributo_id ${atributo_id}.`);
                  } else {
                    throw innerError; // Re-lanza el error si no es una entrada duplicada
                  }
                }
              }
            }
          }
        }
      }

      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Elimina un producto (baja lógica)
   * @param {number} id - ID del producto
   * @returns {boolean} true si se eliminó, false si no se encontró
   */
  static async eliminarProducto(id) {
    console.log('🔄 ProductoService.eliminarProducto - ID:', id);
    
    const [result] = await pool.query(
      'UPDATE productos SET producto_estado = "inactivo" WHERE producto_id = ? AND producto_estado != "inactivo"',
      [id]
    );

    console.log('✅ Producto eliminado (cambiado a inactivo) - Filas afectadas:', result.affectedRows);
    return result.affectedRows > 0;
  }

  /**
   * Cambia la visibilidad de un producto
   * @param {number} id - ID del producto
   * @param {boolean} visible - Nueva visibilidad
   * @returns {boolean} true si se actualizó, false si no se encontró
   */
  static async cambiarVisibilidad(id, visible) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_visible = ? WHERE producto_id = ? AND producto_estado != "eliminado"',
      [visible, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Reactiva un producto eliminado
   * @param {number} id - ID del producto
   * @returns {boolean} true si se reactivó, false si no se encontró
   */
  static async reactivarProducto(id) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_estado = "activo" WHERE producto_id = ? AND producto_estado = "inactivo"',
      [id]
    );

    return result.affectedRows > 0;
  }

  // Métodos para manejo de imágenes temporales
  static async guardarImagenTemporal(usuarioId, imagenUrl, imagenOrden = 0) {
    console.log('🔄 ProductoService.guardarImagenTemporal - Parámetros:', { usuarioId, imagenUrl, imagenOrden });
    
    try {
      const [result] = await pool.query(
        'INSERT INTO imagenes_temporales (usuario_id, imagen_url, imagen_orden) VALUES (?, ?, ?)',
        [usuarioId, imagenUrl, imagenOrden]
      );

      console.log('✅ Imagen temporal guardada - ID:', result.insertId);
      return result.insertId;
    } catch (error) {
      console.error('❌ Error en ProductoService.guardarImagenTemporal:', error);
      throw error;
    }
  }

  static async obtenerImagenesTemporales(usuarioId) {
    const [imagenes] = await pool.query(
      'SELECT imagen_id, imagen_url FROM imagenes_temporales WHERE usuario_id = ? ORDER BY imagen_id ASC',
      [usuarioId]
    );

    return imagenes;
  }

  static async eliminarImagenTemporal(usuarioId, imagenId) {
    console.log('🔄 ProductoService.eliminarImagenTemporal - Parámetros:', { usuarioId, imagenId });
    
    try {
      // Primero obtener la URL de la imagen para poder eliminar el archivo
      const [imagen] = await pool.query(
        'SELECT imagen_url FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?',
        [usuarioId, imagenId]
      );

      if (imagen.length === 0) {
        console.log('❌ Imagen no encontrada en la base de datos');
        return false;
      }

      const imagenUrl = imagen[0].imagen_url;
      console.log('📸 URL de imagen a eliminar:', imagenUrl);

      // Eliminar la imagen de la base de datos
      const [result] = await pool.query(
        'DELETE FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?',
        [usuarioId, imagenId]
      );

      // Eliminar la imagen del sistema de archivos
      const filePath = path.join('uploads', path.basename(imagenUrl));
      console.log('🗂️ Eliminando archivo físico:', filePath);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ Archivo físico eliminado');
      } else {
        console.log('⚠️ Archivo físico no encontrado');
      }

      console.log('✅ Imagen eliminada exitosamente');
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error en ProductoService.eliminarImagenTemporal:', error);
      throw error;
    }
  }

  static async cancelarProcesoAlta(usuarioId) {
    // Obtener imágenes temporales para eliminar archivos
    const imagenes = await this.obtenerImagenesTemporales(usuarioId);
    
    // Eliminar archivos físicos
    for (const imagen of imagenes) {
      const rutaCompleta = path.join('uploads', imagen.imagen_url);
      if (fs.existsSync(rutaCompleta)) {
        fs.unlinkSync(rutaCompleta);
      }
    }

    // Eliminar registros de la base de datos
    const [result] = await pool.query(
      'DELETE FROM imagenes_temporales WHERE usuario_id = ?',
      [usuarioId]
    );

    return result.affectedRows > 0;
  }

  // Métodos para manejo de variantes
  static async verificarVentasVariante(varianteId) {
    const [ventas] = await pool.query(
      'SELECT COUNT(*) as total FROM detalles_ventas WHERE variante_id = ?',
      [varianteId]
    );

    return ventas[0].total > 0;
  }

  static async cambiarEstadoVariante(varianteId, estado) {
    console.log('🔄 ProductoService.cambiarEstadoVariante - Parámetros:', { varianteId, estado });
    
    try {
      const [result] = await pool.query(
        'UPDATE variantes SET variante_estado = ? WHERE variante_id = ?',
        [estado, varianteId]
      );

      console.log('📊 Resultado de la consulta:', result);
      console.log('🔢 Filas afectadas:', result.affectedRows);

      const success = result.affectedRows > 0;
      console.log('✅ Cambio de estado exitoso:', success);
      
      return success;
    } catch (error) {
      console.error('❌ Error en ProductoService.cambiarEstadoVariante:', error);
      throw error;
    }
  }

  /**
   * Cambia la visibilidad de un producto
   * @param {number} productoId - ID del producto
   * @param {boolean} visible - Estado de visibilidad
   * @returns {boolean} true si se actualizó correctamente
   */
  static async cambiarVisibilidadProducto(productoId, visible) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_visible = ? WHERE producto_id = ?',
      [visible, productoId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Obtiene los detalles del stock de un producto
   * @param {number} productoId - ID del producto
   * @returns {Object|null} Detalles del stock o null si no existe
   */
  static async obtenerDetallesStock(productoId) {
    // Obtener detalles del producto principal (siguiendo la lógica del controlador original)
    const [productos] = await pool.query(`
      SELECT 
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
      GROUP BY p.producto_id, ip.imagen_url
    `, [productoId]);

    if (productos.length === 0) {
      return null;
    }

    // Obtener detalles de las variantes (si existen) siguiendo la lógica del controlador original
    const [variantes] = await pool.query(`
      SELECT 
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
      GROUP BY v.variante_id, ip.imagen_url, v.variante_estado
    `, [productoId]);

    // Convertir los precios a números para evitar errores de tipo
    const producto = {
      ...productos[0],
      producto_precio_venta: productos[0].producto_precio_venta ? Number(productos[0].producto_precio_venta) : null,
      producto_precio_oferta: productos[0].producto_precio_oferta ? Number(productos[0].producto_precio_oferta) : null,
      stock_total: Number(productos[0].stock_total)
    };

    const variantesConvertidas = variantes.map(variante => ({
      ...variante,
      variante_precio_venta: variante.variante_precio_venta ? Number(variante.variante_precio_venta) : null,
      variante_precio_oferta: variante.variante_precio_oferta ? Number(variante.variante_precio_oferta) : null,
      stock_total: Number(variante.stock_total)
    }));

    return {
      producto: producto,
      variantes: variantesConvertidas
    };
  }

  /**
   * Sube una imagen para un producto
   * @param {number} productoId - ID del producto
   * @param {string} imagenUrl - URL de la imagen subida
   * @returns {Object} Datos de la imagen subida
   */
  static async subirImagenProducto(productoId, imagenUrl) {
    console.log('🔄 Subiendo imagen al producto:', productoId, 'URL:', imagenUrl);
    
    try {
      // Obtener el próximo orden para la imagen
      const [maxOrden] = await pool.query(
        `SELECT IFNULL(MAX(imagen_orden), -1) + 1 as next_orden FROM imagenes_productos WHERE producto_id = ?`,
        [productoId]
      );
      
      const nextOrden = maxOrden[0].next_orden;
      console.log('📊 Próximo orden:', nextOrden);
      
      // Insertar la imagen
      const [result] = await pool.query(
        `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) VALUES (?, ?, ?)`,
        [productoId, imagenUrl, nextOrden]
      );
      
      console.log('✅ Imagen insertada con ID:', result.insertId);
      
      return {
        imagen_id: result.insertId,
        imagen_url: imagenUrl,
        producto_id: productoId
      };
    } catch (error) {
      console.error('❌ Error en subirImagenProducto:', error);
      throw error;
    }
  }

  /**
   * Elimina imágenes nuevas cuando se cancela la operación
   * @param {number} productoId - ID del producto
   * @param {Array} imagenesIds - IDs de las imágenes a eliminar
   * @returns {boolean} True si se eliminaron correctamente
   */
  static async eliminarImagenesNuevas(productoId, imagenesIds) {
    if (!imagenesIds || imagenesIds.length === 0) {
      return true;
    }

    // Obtener las URLs de las imágenes para borrarlas del sistema de archivos
    const [urls] = await pool.query(
      `SELECT imagen_url FROM imagenes_productos WHERE producto_id = ? AND imagen_id IN (${imagenesIds.map(() => '?').join(',')})`,
      [productoId, ...imagenesIds]
    );

    // Eliminar las imágenes de la base de datos
    await pool.query(
      `DELETE FROM imagenes_productos WHERE producto_id = ? AND imagen_id IN (${imagenesIds.map(() => '?').join(',')})`,
      [productoId, ...imagenesIds]
    );

    // Eliminar las imágenes del sistema de archivos
    urls.forEach(({ imagen_url }) => {
      const filePath = path.join('uploads', path.basename(imagen_url));
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error al eliminar la imagen del sistema de archivos:', err);
      });
    });

    return true;
  }

  /**
   * Mueve una imagen a una nueva posición
   * @param {number} productoId - ID del producto
   * @param {number} imagenId - ID de la imagen a mover
   * @param {number} nuevoOrden - Nueva posición de la imagen
   * @returns {boolean} True si se movió correctamente
   */
  static async moverImagenProducto(productoId, imagenId, nuevoOrden) {
    console.log('🔄 Moviendo imagen:', { productoId, imagenId, nuevoOrden });
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Obtener la imagen actual
      const [imagenActual] = await conn.query(
        `SELECT imagen_orden FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?`,
        [productoId, imagenId]
      );

      if (imagenActual.length === 0) {
        await conn.rollback();
        throw new Error('Imagen no encontrada');
      }

      const ordenActual = imagenActual[0].imagen_orden;
      console.log('📊 Orden actual:', ordenActual, 'Nuevo orden:', nuevoOrden);

      // Si el nuevo orden es igual al actual, no hacer nada
      if (ordenActual === nuevoOrden) {
        await conn.rollback();
        console.log('ℹ️ El orden ya está actualizado');
        return true;
      }

      // Ajustar los órdenes de las demás imágenes
      if (ordenActual < nuevoOrden) {
        // Mover hacia abajo: reducir el orden de las imágenes entre el rango
        console.log('⬇️ Moviendo hacia abajo');
        await conn.query(
          `UPDATE imagenes_productos 
           SET imagen_orden = imagen_orden - 1 
           WHERE producto_id = ? AND imagen_orden > ? AND imagen_orden <= ?`,
          [productoId, ordenActual, nuevoOrden]
        );
      } else {
        // Mover hacia arriba: incrementar el orden de las imágenes entre el rango
        console.log('⬆️ Moviendo hacia arriba');
        await conn.query(
          `UPDATE imagenes_productos 
           SET imagen_orden = imagen_orden + 1 
           WHERE producto_id = ? AND imagen_orden >= ? AND imagen_orden < ?`,
          [productoId, nuevoOrden, ordenActual]
        );
      }

      // Actualizar el orden de la imagen seleccionada
      await conn.query(
        `UPDATE imagenes_productos 
         SET imagen_orden = ? 
         WHERE producto_id = ? AND imagen_id = ?`,
        [nuevoOrden, productoId, imagenId]
      );

      await conn.commit();
      console.log('✅ Imagen movida correctamente');
      return true;
    } catch (error) {
      await conn.rollback();
      console.error('❌ Error al mover imagen:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Elimina una imagen específica
   * @param {number} productoId - ID del producto
   * @param {number} imagenId - ID de la imagen a eliminar
   * @returns {boolean} True si se eliminó correctamente
   */
  static async eliminarImagenProducto(productoId, imagenId) {
    // Obtener la URL de la imagen para eliminarla del sistema de archivos
    const [imagen] = await pool.query(
      `SELECT imagen_url FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?`,
      [productoId, imagenId]
    );

    if (imagen.length === 0) {
      throw new Error('Imagen no encontrada');
    }

    // Eliminar la imagen de la base de datos
    await pool.query(
      `DELETE FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?`,
      [productoId, imagenId]
    );

    // Eliminar la imagen del sistema de archivos
    const filePath = path.join('uploads', path.basename(imagen[0].imagen_url));
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error al eliminar la imagen del sistema de archivos:', err);
    });

    return true;
  }
}

export default ProductoService;
