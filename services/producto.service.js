import { pool } from '../db.js';
import fs from 'fs';
import path from 'path';

/**
 * Servicio optimizado para la gestión de productos
 * Maneja toda la lógica de negocio relacionada con productos
 */
class ProductoService {
  // Queries reutilizables optimizadas
  static QUERIES = {
    PRODUCTO_BASE: `
      SELECT 
        p.producto_id,
        p.producto_nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        p.producto_precio_costo,
        p.producto_sku,
        p.producto_descripcion,
        p.categoria_id,
        p.producto_estado,
        p.producto_visible,
        c.categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
    `,
    
    IMAGEN_PRINCIPAL: `
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id 
      AND ip.imagen_orden = (SELECT MIN(imagen_orden) FROM imagenes_productos WHERE producto_id = p.producto_id)
    `,
    
    STOCK_TOTAL: `
      LEFT JOIN stock s ON s.producto_id = p.producto_id OR s.variante_id IN (
        SELECT variante_id FROM variantes WHERE producto_id = p.producto_id
      )
    `,
    
    VARIANTES_COMPLETAS: `
      SELECT 
        v.variante_id,
        v.variante_precio_venta,
        v.variante_precio_oferta,
        v.variante_precio_costo,
        v.variante_sku,
        v.variante_estado,
        v.imagen_id,
        ip.imagen_url,
        COALESCE(s.cantidad, 0) AS stock_total,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ?
      GROUP BY v.variante_id, v.variante_precio_venta, v.variante_precio_oferta, 
               v.variante_precio_costo, v.variante_sku, v.variante_estado, 
               v.imagen_id, ip.imagen_url, s.cantidad
    `
  };

  // Utilidad para transacciones
  static async withTransaction(callback) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // Utilidad para eliminar archivos de forma segura
  static async eliminarArchivo(rutaArchivo) {
    try {
      if (fs.existsSync(rutaArchivo)) {
        fs.unlinkSync(rutaArchivo);
      }
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
    }
  }
  /**
   * Obtiene todos los productos con sus detalles (optimizado)
   * @param {string} estado - Estado de los productos a filtrar
   * @returns {Array} Lista de productos
   */
  static async obtenerTodosLosProductos(estado = null) {
    const whereClause = estado === 'activos' ? `WHERE p.producto_estado = 'activo'` :
                       estado === 'inactivos' ? `WHERE p.producto_estado = 'inactivo'` :
                       estado === 'pendientes' ? `WHERE p.producto_estado = 'pendiente'` :
                       `WHERE 1 = 1`;

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
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id 
        AND ip.imagen_orden = (SELECT MIN(imagen_orden) FROM imagenes_productos WHERE producto_id = p.producto_id)
      LEFT JOIN stock s ON s.producto_id = p.producto_id OR s.variante_id IN (
        SELECT variante_id FROM variantes WHERE producto_id = p.producto_id
      )
      ${whereClause}
      GROUP BY p.producto_id, ip.imagen_url, c.categoria_nombre, p.producto_visible, p.producto_estado
      ORDER BY p.producto_nombre ASC
    `);

    // Obtener variantes en paralelo para todos los productos
    const productosConVariantes = await Promise.all(
      productos.map(async (producto) => {
        const [variantes] = await pool.query(`
          SELECT 
            v.variante_id, v.variante_sku, v.variante_estado,
            COALESCE(s.cantidad, 0) AS stock_total,
            ip.imagen_url, vv.valor_nombre, a.atributo_nombre
          FROM variantes v
          LEFT JOIN stock s ON s.variante_id = v.variante_id
          LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
          LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
          LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
          WHERE v.producto_id = ? AND v.variante_estado = 'activo'
        `, [producto.producto_id]);
        
        return { ...producto, variantes };
      })
    );
    
    return productosConVariantes;
  }

  /**
   * Obtiene un producto por ID con todos sus detalles (optimizado)
   * @param {number} id - ID del producto
   * @returns {Object|null} Producto completo o null si no existe
   */
  static async obtenerProductoPorId(id) {
    // Ejecutar todas las consultas en paralelo
    const [
      [productoRows],
      [imagenes],
      [variantesRaw],
      [atributosRaw]
    ] = await Promise.all([
      // Datos principales del producto
      pool.query(`
        SELECT 
          p.producto_id,
          p.producto_nombre AS nombre,
          p.producto_precio_venta,
          p.producto_precio_oferta,
          p.producto_precio_costo,
          p.producto_sku,
          p.producto_descripcion,
          p.categoria_id,
          p.producto_estado,
          p.producto_visible,
          c.categoria_nombre,
          COALESCE(SUM(s.cantidad), 0) AS stock_total
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
        LEFT JOIN stock s ON s.producto_id = p.producto_id
        WHERE p.producto_id = ?
        GROUP BY p.producto_id
      `, [id]),
      
      // Imágenes del producto
      pool.query(`
        SELECT imagen_id, imagen_url, imagen_orden 
        FROM imagenes_productos 
        WHERE producto_id = ? 
        ORDER BY imagen_orden ASC
      `, [id]),
      
      // Variantes del producto
      pool.query(`
        SELECT 
          v.variante_id, v.variante_precio_venta, v.variante_precio_oferta,
          v.variante_precio_costo, v.variante_sku, v.imagen_id,
          ip.imagen_url, COALESCE(s.cantidad, 0) AS stock_total
        FROM variantes v
        LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
        LEFT JOIN stock s ON s.variante_id = v.variante_id
        WHERE v.producto_id = ?
      `, [id]),
      
      // Atributos de todas las variantes
      pool.query(`
        SELECT vv.variante_id, a.atributo_nombre, vv.valor_nombre
        FROM valores_variantes vv
        JOIN atributos a ON a.atributo_id = vv.atributo_id
        WHERE vv.variante_id IN (SELECT variante_id FROM variantes WHERE producto_id = ?)
      `, [id])
    ]);

    if (productoRows.length === 0) return null;

    // Optimizar procesamiento de atributos
    const atributosPorVariante = atributosRaw.reduce((acc, attr) => {
      if (!acc[attr.variante_id]) acc[attr.variante_id] = [];
      acc[attr.variante_id].push({
        atributo_nombre: attr.atributo_nombre,
        valor_nombre: attr.valor_nombre
      });
      return acc;
    }, {});

    const producto = {
      ...productoRows[0],
      stock_total: productoRows[0].stock_total || 0,
      imagenes
    };

    const variantes = variantesRaw.map(v => ({
      ...v,
      atributos: atributosPorVariante[v.variante_id] || []
    }));

    return { producto, variantes };
  }

  /**
   * Verifica duplicados de nombre y SKU (optimizado)
   * @param {string} nombre - Nombre del producto
   * @param {number} categoriaId - ID de la categoría
   * @param {number} productoIdExcluir - ID del producto a excluir
   * @returns {boolean} true si existe duplicado
   */
  static async verificarNombreDuplicado(nombre, categoriaId, productoIdExcluir = null) {
    const params = productoIdExcluir ? [nombre, categoriaId, productoIdExcluir] : [nombre, categoriaId];
    const whereClause = productoIdExcluir ? 'AND producto_id != ?' : '';
    
    const [result] = await pool.query(
      `SELECT 1 FROM productos 
       WHERE producto_nombre = ? AND categoria_id = ? ${whereClause} 
       AND producto_estado != "inactivo" LIMIT 1`,
      params
    );
    return result.length > 0;
  }

  /**
   * Verifica si existe un producto con el mismo SKU (optimizado)
   * @param {string} sku - SKU del producto
   * @param {number} productoIdExcluir - ID del producto a excluir
   * @returns {boolean} true si existe duplicado
   */
  static async verificarSkuDuplicado(sku, productoIdExcluir = null) {
    if (!sku) return false;

    const params = productoIdExcluir ? [sku, productoIdExcluir] : [sku];
    const whereClause = productoIdExcluir ? 'AND producto_id != ?' : '';
    
    const [result] = await pool.query(
      `SELECT 1 FROM productos 
       WHERE producto_sku = ? ${whereClause} 
       AND producto_estado != "inactivo" LIMIT 1`,
      params
    );
    return result.length > 0;
  }

  /**
   * Busca productos por nombre parcial (optimizado)
   * @param {string} nombre - Nombre parcial del producto
   * @param {number} categoriaId - ID de la categoría (opcional)
   * @returns {Array} Lista de productos que coinciden
   */
  static async buscarProductosPorNombre(nombre, categoriaId = null) {
    const params = [`%${nombre}%`];
    const whereCategoria = categoriaId ? 'AND p.categoria_id = ?' : '';
    
    if (categoriaId) params.push(categoriaId);

    const [productos] = await pool.query(`
      SELECT p.producto_id, p.producto_nombre, p.categoria_id, c.categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      WHERE p.producto_nombre LIKE ? AND p.producto_estado != 'inactivo' ${whereCategoria}
      ORDER BY p.producto_nombre ASC 
      LIMIT 10
    `, params);
    
    return productos;
  }

    /**
   * Busca productos por nombre parcial (optimizado)
   * @param {string} nombre - Nombre parcial del producto
   * @param {number} categoriaId - ID de la categoría (opcional)
   * @returns {Array} Lista de productos que coinciden
   */
  static async buscarProductosPorNombreSinEstado(nombre, categoriaId = null) {
    const params = [`%${nombre}%`];
    const whereCategoria = categoriaId ? 'AND p.categoria_id = ?' : '';
    if (categoriaId) params.push(categoriaId);

    // Traer la imagen principal (la de menor orden) igual que ventas
    const [productos] = await pool.query(`
      SELECT 
        p.producto_id, 
        p.producto_nombre, 
        p.categoria_id, 
        c.categoria_nombre,
        ip.imagen_url
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) FROM imagenes_productos WHERE producto_id = p.producto_id
      )
      WHERE p.producto_nombre LIKE ? ${whereCategoria}
      ORDER BY p.producto_nombre ASC 
      LIMIT 10
    `, params);
    return productos;
  }

  // Métodos CRUD optimizados
  static async eliminarProducto(id) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_estado = "inactivo" WHERE producto_id = ? AND producto_estado != "inactivo"',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async cambiarVisibilidad(id, visible) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_visible = ? WHERE producto_id = ? AND producto_estado != "inactivo"',
      [visible, id]
    );
    return result.affectedRows > 0;
  }

  static async reactivarProducto(id) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_estado = "activo" WHERE producto_id = ? AND producto_estado = "inactivo"',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Crea un nuevo producto (optimizado con transacciones)
   * @param {Object} datos - Datos del producto
   * @returns {Object} Producto creado
   */
  static async crearProducto(datos) {
    const {
      usuario_id, categoria_id, producto_nombre, producto_descripcion,
      producto_precio_venta, producto_precio_costo, producto_precio_oferta,
      producto_sku, producto_stock, imagenes, atributos, variantes
    } = datos;

    // Validar duplicados en paralelo
    const [nombreDuplicado, skuDuplicado] = await Promise.all([
      this.verificarNombreDuplicado(producto_nombre, categoria_id),
      producto_sku ? this.verificarSkuDuplicado(producto_sku) : Promise.resolve(false)
    ]);

    if (nombreDuplicado) throw new Error('Ya existe un producto con ese nombre en la misma categoría');
    if (skuDuplicado) throw new Error('Ya existe un producto con ese SKU');

    return await this.withTransaction(async (conn) => {
      // Determinar estado del producto
      const tieneVarianteConPrecio = variantes?.some(v => v.precio_venta && parseFloat(v.precio_venta) > 0);
      const producto_estado = (variantes?.length > 0) ? 
        (tieneVarianteConPrecio ? 'activo' : 'pendiente') : 
        (producto_precio_venta ? 'activo' : 'pendiente');

      // Insertar producto
      const [productoResult] = await conn.query(`
        INSERT INTO productos (
          categoria_id, producto_nombre, producto_descripcion,
          producto_precio_venta, producto_precio_costo, producto_precio_oferta,
          producto_sku, producto_estado, producto_visible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        categoria_id, producto_nombre, producto_descripcion || null,
        producto_precio_venta || null, producto_precio_costo || null,
        producto_precio_oferta || null, producto_sku || null,
        producto_estado, true
      ]);

      const producto_id = productoResult.insertId;

      // Procesar operaciones en paralelo cuando sea posible
      const operaciones = [];

      // Stock inicial
      if (producto_stock) {
        operaciones.push(
          conn.query('INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)', [producto_id, producto_stock])
        );
      }

      // Procesar imágenes temporales
      if (imagenes?.length > 0) {
        const imagenQueries = imagenes.map((imagen, index) =>
          conn.query(
            `INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden)
             SELECT ?, imagen_url, ? FROM imagenes_temporales
             WHERE usuario_id = ? AND imagen_id = ?`,
            [producto_id, index, usuario_id, imagen.id]
          )
        );
        operaciones.push(...imagenQueries);
        operaciones.push(conn.query('DELETE FROM imagenes_temporales WHERE usuario_id = ?', [usuario_id]));
      }

      // Ejecutar operaciones en paralelo
      if (operaciones.length > 0) {
        await Promise.all(operaciones);
      }

      // Procesar atributos y variantes secuencialmente (debido a dependencias)
      const atributoIds = {};
      if (atributos?.length > 0) {
        for (const atributo of atributos) {
          const [atributoResult] = await conn.query(
            'INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)',
            [producto_id, atributo.atributo_nombre]
          );
          atributoIds[atributo.atributo_nombre] = atributoResult.insertId;
        }
      }

      // Procesar variantes
      if (variantes?.length > 0) {
        for (const variante of variantes) {
          const imagen_id = variante.imagen_url ? 
            await this.obtenerImagenIdPorUrl(conn, producto_id, variante.imagen_url) : null;

          const variante_estado = variante.precio_venta ? 'activo' : 'pendiente';

          const [varianteResult] = await conn.query(`
            INSERT INTO variantes (
              producto_id, imagen_id, variante_precio_venta, variante_precio_costo,
              variante_precio_oferta, variante_sku, variante_estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            producto_id, imagen_id, variante.precio_venta,
            variante.precio_costo || null, variante.precio_oferta || null,
            variante.sku || null, variante_estado
          ]);

          const variante_id = varianteResult.insertId;

          // Stock de variante
          if (variante.stock) {
            await conn.query('INSERT INTO stock (variante_id, cantidad) VALUES (?, ?)', [variante_id, variante.stock]);
          }

          // Valores de variante
          if (variante.valores?.length > 0) {
            for (const valor of variante.valores) {
              const atributo_nombre = Object.keys(atributoIds).find(nombre =>
                atributos.some(attr => attr.atributo_nombre === nombre)
              );
              if (atributo_nombre) {
                await conn.query(
                  'INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)',
                  [variante_id, atributoIds[atributo_nombre], valor]
                );
              }
            }
          }
        }
      }

      return { producto_id, producto_estado };
    });
  }

  // Método auxiliar para obtener imagen_id por URL
  static async obtenerImagenIdPorUrl(conn, producto_id, imagen_url) {
    const [imagenResult] = await conn.query(
      'SELECT imagen_id FROM imagenes_productos WHERE producto_id = ? AND imagen_url = ?',
      [producto_id, imagen_url]
    );
    return imagenResult.length > 0 ? imagenResult[0].imagen_id : null;
  }

  /**
   * Actualiza un producto existente (optimizado)
   * @param {number} id - ID del producto
   * @param {Object} datos - Datos a actualizar
   * @returns {boolean} true si se actualizó
   */
  static async actualizarProducto(id, datos) {
    const {
      categoria_id, producto_nombre, producto_descripcion,
      producto_precio_venta, producto_precio_costo, producto_precio_oferta, producto_sku
    } = datos;

    // Validaciones en paralelo
    const [productoExistente, nombreDuplicado, skuDuplicado] = await Promise.all([
      pool.query('SELECT 1 FROM productos WHERE producto_id = ? AND producto_estado != "inactivo"', [id]),
      this.verificarNombreDuplicado(producto_nombre, categoria_id, id),
      producto_sku ? this.verificarSkuDuplicado(producto_sku, id) : Promise.resolve(false)
    ]);

    if (productoExistente[0].length === 0) return false;
    if (nombreDuplicado) throw new Error('Ya existe un producto con ese nombre en la misma categoría');
    if (skuDuplicado) throw new Error('Ya existe un producto con ese SKU');

    const [result] = await pool.query(`
      UPDATE productos 
      SET categoria_id = ?, producto_nombre = ?, producto_descripcion = ?, 
          producto_precio_venta = ?, producto_precio_costo = ?, 
          producto_precio_oferta = ?, producto_sku = ?
      WHERE producto_id = ?
    `, [
      categoria_id, producto_nombre, producto_descripcion || null,
      producto_precio_venta || null, producto_precio_costo || null,
      producto_precio_oferta || null, producto_sku || null, id
    ]);

    return result.affectedRows > 0;
  }

  /**
   * Actualiza un producto completo (optimizado con métodos auxiliares)
   * @param {number} id - ID del producto
   * @param {Object} datos - Datos a actualizar
   * @returns {boolean} true si se actualizó correctamente
   */
  static async actualizarProductoCompleto(id, datos) {
    const {
      producto_nombre, categoria_id, producto_descripcion,
      producto_precio_venta, producto_precio_costo, producto_precio_oferta,
      producto_sku, producto_stock, imagenes, variantes
    } = datos;

    if (!producto_nombre || !categoria_id) {
      throw new Error('El nombre del producto y la categoría son obligatorios.');
    }

    return await this.withTransaction(async (conn) => {
      // Obtener estado actual del producto
      const [producto] = await conn.query('SELECT producto_estado FROM productos WHERE producto_id = ?', [id]);
      if (producto.length === 0) throw new Error('Producto no encontrado');
      
      // Determinar nuevo estado
      const nuevoEstado = this.determinarEstadoProducto(variantes, producto_precio_venta, producto[0].producto_estado);
      
      // Actualizar producto principal
      await this.actualizarProductoPrincipal(conn, id, {
        producto_nombre, categoria_id, producto_descripcion,
        producto_precio_venta, producto_precio_costo, producto_precio_oferta,
        producto_sku, variantes, nuevoEstado
      });

      // Manejar stock del producto
      await this.manejarStockProducto(conn, id, producto_stock, variantes);

      // Actualizar imágenes
      if (imagenes?.length > 0) {
        await this.actualizarImagenesProducto(conn, id, imagenes);
      }

      // Actualizar variantes
      if (variantes !== undefined) {
        await this.actualizarVariantesProducto(conn, id, variantes, producto_stock);
      }

      return true;
    });
  }

  // Métodos auxiliares para optimizar actualizarProductoCompleto
  static determinarEstadoProducto(variantes, precio_venta, estadoActual) {
    if (variantes?.length > 0) {
      const tieneVarianteConPrecio = variantes.some(v => 
        v.precio_venta !== null && v.precio_venta !== undefined && parseFloat(v.precio_venta) > 0
      );
      return tieneVarianteConPrecio ? 'activo' : estadoActual;
    }
    return (precio_venta !== null && precio_venta !== undefined && parseFloat(precio_venta) > 0) ? 'activo' : estadoActual;
  }

  static async actualizarProductoPrincipal(conn, id, datos) {
    const { producto_nombre, categoria_id, producto_descripcion, variantes, nuevoEstado } = datos;
    
    // Si tiene variantes, limpiar precios del producto principal
    const precios = variantes?.length > 0 ? [null, null, null, null] : [
      datos.producto_precio_venta, datos.producto_precio_costo, 
      datos.producto_precio_oferta, datos.producto_sku
    ];

    await conn.query(`
      UPDATE productos SET 
        producto_nombre = ?, categoria_id = ?, producto_descripcion = ?, 
        producto_precio_venta = ?, producto_precio_costo = ?, 
        producto_precio_oferta = ?, producto_sku = ?, producto_estado = ?
      WHERE producto_id = ?
    `, [
      producto_nombre, categoria_id, producto_descripcion || null,
      ...precios, nuevoEstado, id
    ]);
  }

  static async manejarStockProducto(conn, id, producto_stock, variantes) {
    const [stockExistente] = await conn.query(
      'SELECT stock_id FROM stock WHERE producto_id = ? AND variante_id IS NULL',
      [id]
    );

    const stockCantidad = variantes?.length > 0 ? 0 : (producto_stock ?? 0);

    if (stockExistente.length > 0) {
      await conn.query(
        'UPDATE stock SET cantidad = ? WHERE producto_id = ? AND variante_id IS NULL',
        [stockCantidad, id]
      );
    } else {
      await conn.query(
        'INSERT INTO stock (producto_id, cantidad) VALUES (?, ?)',
        [id, stockCantidad]
      );
    }
  }

  static async actualizarImagenesProducto(conn, id, imagenes) {
    const imagenesValidas = imagenes.filter(img => img.url?.trim());
    
    if (imagenesValidas.length > 0) {
      await conn.query('DELETE FROM imagenes_productos WHERE producto_id = ?', [id]);
      
      const imagenQueries = imagenesValidas.map((imagen, index) =>
        conn.query(
          'INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) VALUES (?, ?, ?)',
          [id, imagen.url, index]
        )
      );
      
      await Promise.all(imagenQueries);
    }
  }

  static async actualizarVariantesProducto(conn, id, variantes, producto_stock) {
    if (variantes.length === 0) {
      // Eliminar historial de precios de todas las variantes del producto
      await conn.query(`
        DELETE FROM precios_historicos 
        WHERE ph_variante_id IN (
          SELECT variante_id FROM variantes WHERE producto_id = ?
        )
      `, [id]);
      
      // Eliminar todas las variantes
      await conn.query('DELETE FROM variantes WHERE producto_id = ?', [id]);
      return;
    }

    // Obtener IDs de variantes enviadas
    const varianteIdsEnviadas = variantes.map(v => v.variante_id).filter(Boolean);
    
    if (varianteIdsEnviadas.length > 0) {
      // Eliminar historial de precios de variantes no enviadas
      await conn.query(`
        DELETE FROM precios_historicos 
        WHERE ph_variante_id IN (
          SELECT variante_id FROM variantes 
          WHERE producto_id = ? AND variante_id NOT IN (?)
        )
      `, [id, varianteIdsEnviadas]);
      
      // Eliminar variantes no enviadas
      await conn.query(
        'DELETE FROM variantes WHERE producto_id = ? AND variante_id NOT IN (?)',
        [id, varianteIdsEnviadas]
      );
    }

    // Procesar atributos únicos
    const atributoIds = await this.procesarAtributosUnicos(conn, id, variantes);

    // Procesar cada variante
    for (const variante of variantes) {
      await this.procesarVariante(conn, id, variante, atributoIds);
    }
  }

  static async procesarAtributosUnicos(conn, id, variantes) {
    const atributosUnicos = new Set();
    variantes.forEach(v => {
      v.valores?.forEach(valor => {
        if (valor.atributo_nombre) atributosUnicos.add(valor.atributo_nombre);
      });
    });

    const atributoIds = {};
    for (const atributo_nombre of atributosUnicos) {
      const [atributoExistente] = await conn.query(
        'SELECT atributo_id FROM atributos WHERE producto_id = ? AND atributo_nombre = ?',
        [id, atributo_nombre]
      );

      if (atributoExistente.length > 0) {
        atributoIds[atributo_nombre] = atributoExistente[0].atributo_id;
      } else {
        const [atributoResult] = await conn.query(
          'INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)',
          [id, atributo_nombre]
        );
        atributoIds[atributo_nombre] = atributoResult.insertId;
      }
    }

    return atributoIds;
  }

  static async procesarVariante(conn, id, variante, atributoIds) {
    const imagen_id = variante.imagen_url ? 
      await this.obtenerImagenIdPorUrl(conn, id, variante.imagen_url) : null;

    const nuevoEstado = (variante.precio_venta > 0) ? 'activo' : variante.variante_estado;
    let variante_id = variante.variante_id;

    if (variante_id) {
      // Actualizar variante existente
      await conn.query(`
        UPDATE variantes SET 
          variante_precio_venta = ?, variante_precio_costo = ?, 
          variante_precio_oferta = ?, variante_sku = ?, 
          imagen_id = ?, variante_estado = ?
        WHERE variante_id = ?
      `, [
        variante.precio_venta || null, variante.precio_costo || null,
        variante.precio_oferta || null, variante.sku || null,
        imagen_id, nuevoEstado, variante_id
      ]);
    } else {
      // Crear nueva variante
      const [varianteResult] = await conn.query(`
        INSERT INTO variantes (
          producto_id, imagen_id, variante_precio_venta, variante_precio_costo,
          variante_precio_oferta, variante_sku, variante_estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        id, imagen_id, variante.precio_venta || null, variante.precio_costo || null,
        variante.precio_oferta || null, variante.sku || null, nuevoEstado
      ]);
      variante_id = varianteResult.insertId;
    }

    // Actualizar stock de variante
    if (variante.stock !== undefined) {
      await this.actualizarStockVariante(conn, variante_id, variante.stock);
    }

    // Actualizar valores de variante
    if (variante.valores?.length > 0) {
      await conn.query('DELETE FROM valores_variantes WHERE variante_id = ?', [variante_id]);
      
      const valorQueries = variante.valores.map(valor => {
        const atributo_id = atributoIds[valor.atributo_nombre];
        return atributo_id ? conn.query(
          'INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)',
          [variante_id, atributo_id, valor.valor_nombre]
        ) : null;
      }).filter(Boolean);

      if (valorQueries.length > 0) {
        await Promise.all(valorQueries);
      }
    }
  }

  static async actualizarStockVariante(conn, variante_id, stock) {
    const stockCantidad = stock ?? 0;
    
    const [stockExistente] = await conn.query(
      'SELECT stock_id FROM stock WHERE variante_id = ?',
      [variante_id]
    );

    if (stockExistente.length > 0) {
      await conn.query(
        'UPDATE stock SET cantidad = ? WHERE variante_id = ?',
        [stockCantidad, variante_id]
      );
    } else {
      await conn.query(
        'INSERT INTO stock (variante_id, cantidad) VALUES (?, ?)',
        [variante_id, stockCantidad]
      );
    }
  }

  // Métodos optimizados para imágenes temporales
  static async guardarImagenTemporal(usuarioId, imagenUrl, imagenOrden = 0) {
    try {
      const [result] = await pool.query(
        'INSERT INTO imagenes_temporales (usuario_id, imagen_url, imagen_orden) VALUES (?, ?, ?)',
        [usuarioId, imagenUrl, imagenOrden]
      );
      return result.insertId;
    } catch (error) {
      console.error('❌ Error en guardarImagenTemporal:', error);
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
    try {
      const [imagen] = await pool.query(
        'SELECT imagen_url FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?',
        [usuarioId, imagenId]
      );

      if (imagen.length === 0) return false;

      const [result] = await pool.query(
        'DELETE FROM imagenes_temporales WHERE usuario_id = ? AND imagen_id = ?',
        [usuarioId, imagenId]
      );

      // Eliminar archivo físico
      const filePath = path.join('uploads', path.basename(imagen[0].imagen_url));
      await this.eliminarArchivo(filePath);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error en eliminarImagenTemporal:', error);
      throw error;
    }
  }

  static async cancelarProcesoAlta(usuarioId) {
    const imagenes = await this.obtenerImagenesTemporales(usuarioId);
    
    // Eliminar archivos físicos en paralelo
    const eliminaciones = imagenes.map(imagen => 
      this.eliminarArchivo(path.join('uploads', imagen.imagen_url))
    );
    
    await Promise.all(eliminaciones);

    const [result] = await pool.query(
      'DELETE FROM imagenes_temporales WHERE usuario_id = ?',
      [usuarioId]
    );

    return result.affectedRows > 0;
  }

  // Métodos optimizados para variantes
  static async verificarVentasVariante(varianteId) {
    const [ventas] = await pool.query(
      'SELECT 1 FROM detalles_ventas WHERE variante_id = ? LIMIT 1',
      [varianteId]
    );
    return ventas.length > 0;
  }

  static async cambiarEstadoVariante(varianteId, estado) {
    try {
      const [result] = await pool.query(
        'UPDATE variantes SET variante_estado = ? WHERE variante_id = ?',
        [estado, varianteId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error en cambiarEstadoVariante:', error);
      throw error;
    }
  }

  static async cambiarVisibilidadProducto(productoId, visible) {
    const [result] = await pool.query(
      'UPDATE productos SET producto_visible = ? WHERE producto_id = ?',
      [visible, productoId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Obtiene detalles del stock de un producto (optimizado)
   * @param {number} productoId - ID del producto
   * @returns {Object|null} Detalles del stock
   */
  static async obtenerDetallesStock(productoId) {
    const [
      [productos],
      [variantes]
    ] = await Promise.all([
      // Producto principal con imagen y stock
      pool.query(`
        SELECT 
          p.producto_id, p.producto_nombre AS nombre, p.producto_precio_venta,
          p.producto_precio_oferta, p.producto_sku, p.producto_descripcion,
          ip.imagen_url, COALESCE(SUM(s.cantidad), 0) AS stock_total
        FROM productos p
        LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id 
          AND ip.imagen_orden = (SELECT MIN(imagen_orden) FROM imagenes_productos WHERE producto_id = p.producto_id)
        LEFT JOIN stock s ON s.producto_id = p.producto_id
        WHERE p.producto_id = ?
        GROUP BY p.producto_id, ip.imagen_url
      `, [productoId]),

      // Variantes con stock y atributos
      pool.query(this.QUERIES.VARIANTES_COMPLETAS, [productoId])
    ]);

    if (productos.length === 0) return null;

    const producto = {
      ...productos[0],
      producto_precio_venta: productos[0].producto_precio_venta ? Number(productos[0].producto_precio_venta) : null,
      producto_precio_oferta: productos[0].producto_precio_oferta ? Number(productos[0].producto_precio_oferta) : null,
      stock_total: Number(productos[0].stock_total)
    };

    const variantesConvertidas = variantes.map(v => ({
      ...v,
      variante_precio_venta: v.variante_precio_venta ? Number(v.variante_precio_venta) : null,
      variante_precio_oferta: v.variante_precio_oferta ? Number(v.variante_precio_oferta) : null,
      stock_total: Number(v.stock_total)
    }));

    return { producto, variantes: variantesConvertidas };
  }

  /**
   * Métodos optimizados para gestión de imágenes de productos
   */
  static async subirImagenProducto(productoId, imagenUrl) {
    try {
      const [maxOrden] = await pool.query(
        'SELECT IFNULL(MAX(imagen_orden), -1) + 1 as next_orden FROM imagenes_productos WHERE producto_id = ?',
        [productoId]
      );
      
      const [result] = await pool.query(
        'INSERT INTO imagenes_productos (producto_id, imagen_url, imagen_orden) VALUES (?, ?, ?)',
        [productoId, imagenUrl, maxOrden[0].next_orden]
      );
      
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

  static async eliminarImagenesNuevas(productoId, imagenesIds) {
    if (!imagenesIds?.length) return true;

    const placeholders = imagenesIds.map(() => '?').join(',');
    const [urls] = await pool.query(
      `SELECT imagen_url FROM imagenes_productos WHERE producto_id = ? AND imagen_id IN (${placeholders})`,
      [productoId, ...imagenesIds]
    );

    // Eliminar de BD e imágenes físicas en paralelo
    const eliminaciones = [
      pool.query(
        `DELETE FROM imagenes_productos WHERE producto_id = ? AND imagen_id IN (${placeholders})`,
        [productoId, ...imagenesIds]
      ),
      ...urls.map(({ imagen_url }) => 
        this.eliminarArchivo(path.join('uploads', path.basename(imagen_url)))
      )
    ];

    await Promise.all(eliminaciones);
    return true;
  }

  static async moverImagenProducto(productoId, imagenId, nuevoOrden) {
    return await this.withTransaction(async (conn) => {
      const [imagenActual] = await conn.query(
        'SELECT imagen_orden FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?',
        [productoId, imagenId]
      );

      if (imagenActual.length === 0) {
        throw new Error('Imagen no encontrada');
      }

      const ordenActual = imagenActual[0].imagen_orden;
      if (ordenActual === nuevoOrden) return true;

      // Actualizar órdenes de imágenes afectadas
      if (ordenActual < nuevoOrden) {
        await conn.query(
          'UPDATE imagenes_productos SET imagen_orden = imagen_orden - 1 WHERE producto_id = ? AND imagen_orden > ? AND imagen_orden <= ?',
          [productoId, ordenActual, nuevoOrden]
        );
      } else {
        await conn.query(
          'UPDATE imagenes_productos SET imagen_orden = imagen_orden + 1 WHERE producto_id = ? AND imagen_orden >= ? AND imagen_orden < ?',
          [productoId, nuevoOrden, ordenActual]
        );
      }

      // Actualizar la imagen seleccionada
      await conn.query(
        'UPDATE imagenes_productos SET imagen_orden = ? WHERE producto_id = ? AND imagen_id = ?',
        [nuevoOrden, productoId, imagenId]
      );

      return true;
    });
  }

  static async eliminarImagenProducto(productoId, imagenId) {
    const [imagen] = await pool.query(
      'SELECT imagen_url FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?',
      [productoId, imagenId]
    );

    if (imagen.length === 0) {
      throw new Error('Imagen no encontrada');
    }

    // Eliminar de BD y archivo físico en paralelo
    await Promise.all([
      pool.query('DELETE FROM imagenes_productos WHERE producto_id = ? AND imagen_id = ?', [productoId, imagenId]),
      this.eliminarArchivo(path.join('uploads', path.basename(imagen[0].imagen_url)))
    ]);

    return true;
  }
}

export default ProductoService;
