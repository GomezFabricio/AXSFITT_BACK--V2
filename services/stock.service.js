import { pool } from '../db.js';

/**
 * Servicio para gestión de stock
 * Maneja operaciones de stock, faltantes y control de inventario
 */
export class StockService {
  // ==================== QUERIES ESTÁTICAS ====================
  
  static QUERIES = {
    // Obtener stock de productos con información completa
    OBTENER_STOCK_PRODUCTOS: `
      SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        c.categoria_nombre AS categoria,
        COALESCE(SUM(s.cantidad), 0) AS stock_total,
        ip.imagen_url,
        p.producto_visible,
        p.producto_estado,
        COALESCE(s.stock_minimo, 0) AS stock_minimo,
        COALESCE(s.stock_maximo, NULL) AS stock_maximo
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
    `,

    // Obtener variantes de un producto específico
    OBTENER_VARIANTES_PRODUCTO: `
      SELECT 
        v.variante_id,
        v.variante_sku,
        COALESCE(s.cantidad, 0) AS stock_total,
        ip.imagen_url,
        vv.valor_nombre,
        a.atributo_nombre,
        v.variante_estado,
        COALESCE(s.stock_minimo, 0) AS stock_minimo,
        COALESCE(s.stock_maximo, NULL) AS stock_maximo
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ? AND v.variante_estado = 'activo'
    `,

    // Verificar si existe registro de stock
    VERIFICAR_STOCK_EXISTENTE: `
      SELECT stock_id FROM stock WHERE {campo} = ?
    `,

    // Actualizar stock existente
    ACTUALIZAR_STOCK: `
      UPDATE stock SET stock_minimo = ?, stock_maximo = ? WHERE {campo} = ?
    `,

    // Obtener faltantes registrados de productos
    OBTENER_FALTANTES_PRODUCTOS_REGISTRADOS: `
      SELECT 
        p.producto_id,
        p.producto_nombre AS nombre,
        c.categoria_nombre AS categoria,
        COALESCE(s.cantidad, 0) AS stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        f.cantidad_faltante,
        ip.imagen_url,
        'producto' AS tipo,
        f.id_faltante,
        f.fecha_deteccion
      FROM faltantes f
      JOIN productos p ON f.producto_id = p.producto_id
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      WHERE f.resuelto = FALSE AND f.producto_id IS NOT NULL
    `,

    // Obtener faltantes registrados de variantes
    OBTENER_FALTANTES_VARIANTES_REGISTRADAS: `
      SELECT 
        v.variante_id,
        p.producto_nombre AS producto_nombre,
        v.variante_sku,
        COALESCE(s.cantidad, 0) AS stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        f.cantidad_faltante,
        ip.imagen_url,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
        'variante' AS tipo,
        f.id_faltante,
        f.fecha_deteccion
      FROM faltantes f
      JOIN variantes v ON f.variante_id = v.variante_id
      JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE f.resuelto = FALSE AND f.variante_id IS NOT NULL
      GROUP BY v.variante_id, p.producto_nombre, v.variante_sku, s.cantidad, s.stock_minimo, s.stock_maximo, ip.imagen_url, f.id_faltante, f.fecha_deteccion
    `,

    // Obtener productos con stock por debajo del mínimo (no registrados)
    OBTENER_FALTANTES_PRODUCTOS_POR_REGISTRAR: `
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
        NULL as id_faltante,
        NULL as fecha_deteccion
      FROM productos p
      JOIN stock s ON s.producto_id = p.producto_id
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      WHERE p.producto_estado = 'activo' 
        AND s.cantidad < s.stock_minimo
        AND s.variante_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM faltantes f 
          WHERE f.producto_id = p.producto_id AND f.resuelto = FALSE
        )
      ORDER BY cantidad_faltante DESC
    `,

    // Obtener variantes con stock por debajo del mínimo (no registradas)
    OBTENER_FALTANTES_VARIANTES_POR_REGISTRAR: `
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
        NULL as id_faltante,
        NULL as fecha_deteccion
      FROM variantes v
      JOIN stock s ON s.variante_id = v.variante_id
      JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.variante_estado = 'activo' 
        AND s.cantidad < s.stock_minimo
        AND NOT EXISTS (
          SELECT 1 FROM faltantes f 
          WHERE f.variante_id = v.variante_id AND f.resuelto = FALSE
        )
      GROUP BY v.variante_id, p.producto_nombre, v.variante_sku, s.cantidad, s.stock_minimo, s.stock_maximo, ip.imagen_url
      ORDER BY cantidad_faltante DESC
    `,

    // Verificar faltante existente
    VERIFICAR_FALTANTE_EXISTENTE: `
      SELECT id_faltante FROM faltantes 
      WHERE {campo} = ? AND resuelto = FALSE
    `,

    // Actualizar faltante existente
    ACTUALIZAR_FALTANTE: `
      UPDATE faltantes 
      SET cantidad_faltante = ?, fecha_deteccion = CURRENT_TIMESTAMP 
      WHERE id_faltante = ?
    `,

    // Crear nuevo faltante
    CREAR_FALTANTE: `
      INSERT INTO faltantes (producto_id, variante_id, cantidad_faltante) 
      VALUES (?, ?, ?)
    `,

    // Resolver faltante
    RESOLVER_FALTANTE: `
      UPDATE faltantes SET resuelto = TRUE WHERE id_faltante = ?
    `
  };

  // ==================== MÉTODOS DEL SERVICIO ====================

  /**
   * Obtiene el stock de todos los productos con sus variantes
   * @returns {Promise<Array>} Lista de productos con información de stock
   */
  static async obtenerStock() {
    console.log('📦 Obteniendo stock de productos...');
    
    try {
      const [productos] = await pool.query(this.QUERIES.OBTENER_STOCK_PRODUCTOS);
      
      // Obtener variantes para cada producto usando Promise.all para optimizar
      const productosConVariantes = await Promise.all(
        productos.map(async (producto) => {
          const [variantes] = await pool.query(
            this.QUERIES.OBTENER_VARIANTES_PRODUCTO,
            [producto.producto_id]
          );
          
          return {
            ...producto,
            variantes
          };
        })
      );
      
      console.log(`✅ Stock obtenido: ${productosConVariantes.length} productos`);
      return productosConVariantes;
    } catch (error) {
      console.error('❌ Error en obtenerStock:', error);
      throw error;
    }
  }

  /**
   * Actualiza los valores mínimo y máximo de stock
   * @param {number} id - ID del producto o variante
   * @param {number} stockMinimo - Valor mínimo de stock
   * @param {number} stockMaximo - Valor máximo de stock
   * @param {string} tipo - Tipo: 'producto' o 'variante'
   * @returns {Promise<void>}
   */
  static async actualizarStock(id, stockMinimo, stockMaximo, tipo) {
    console.log(`🔄 Actualizando stock ${tipo} ID ${id}...`);
    
    try {
      // Validar tipo
      if (!['producto', 'variante'].includes(tipo)) {
        throw new Error("Tipo inválido. Debe ser 'producto' o 'variante'");
      }

      const campoClave = tipo === 'producto' ? 'producto_id' : 'variante_id';
      
      // Verificar que existe el registro de stock
      const queryVerificar = this.QUERIES.VERIFICAR_STOCK_EXISTENTE.replace('{campo}', campoClave);
      const [stockExistente] = await pool.query(queryVerificar, [id]);

      if (stockExistente.length === 0) {
        throw new Error("Registro de stock no encontrado. No se puede crear uno nuevo automáticamente.");
      }

      // Actualizar stock
      const queryActualizar = this.QUERIES.ACTUALIZAR_STOCK.replace('{campo}', campoClave);
      await pool.query(queryActualizar, [stockMinimo, stockMaximo, id]);

      console.log(`✅ Stock actualizado correctamente para ${tipo} ID ${id}`);
    } catch (error) {
      console.error(`❌ Error al actualizar stock ${tipo} ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene todos los faltantes (registrados y por registrar)
   * @returns {Promise<Array>} Lista de faltantes
   */
  static async obtenerFaltantes() {
    console.log('🔍 Obteniendo faltantes...');
    
    try {
      // Ejecutar todas las consultas en paralelo para optimizar
      const [
        [faltantesProductosRegistrados],
        [faltantesVariantesRegistradas],
        [faltantesProductosPorRegistrar],
        [faltantesVariantesPorRegistrar]
      ] = await Promise.all([
        pool.query(this.QUERIES.OBTENER_FALTANTES_PRODUCTOS_REGISTRADOS),
        pool.query(this.QUERIES.OBTENER_FALTANTES_VARIANTES_REGISTRADAS),
        pool.query(this.QUERIES.OBTENER_FALTANTES_PRODUCTOS_POR_REGISTRAR),
        pool.query(this.QUERIES.OBTENER_FALTANTES_VARIANTES_POR_REGISTRAR)
      ]);

      // Combinar resultados
      const faltantes = [
        ...faltantesProductosRegistrados,
        ...faltantesVariantesRegistradas,
        ...faltantesProductosPorRegistrar,
        ...faltantesVariantesPorRegistrar
      ];

      console.log(`✅ Faltantes obtenidos: ${faltantes.length} elementos`);
      return faltantes;
    } catch (error) {
      console.error('❌ Error en obtenerFaltantes:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo faltante o actualiza uno existente
   * @param {number} productoId - ID del producto (opcional)
   * @param {number} varianteId - ID de la variante (opcional)
   * @param {number} cantidadFaltante - Cantidad faltante
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async registrarFaltante(productoId, varianteId, cantidadFaltante) {
    console.log(`📝 Registrando faltante - Producto: ${productoId}, Variante: ${varianteId}...`);
    
    try {
      // Validaciones
      if ((!productoId && !varianteId) || !cantidadFaltante) {
        throw new Error('Debe especificar un producto o variante y la cantidad faltante');
      }

      const campo = productoId ? 'producto_id' : 'variante_id';
      const valorCampo = productoId || varianteId;

      // Verificar si ya existe un registro de faltante no resuelto
      const queryVerificar = this.QUERIES.VERIFICAR_FALTANTE_EXISTENTE.replace('{campo}', campo);
      const [faltanteExistente] = await pool.query(queryVerificar, [valorCampo]);

      if (faltanteExistente.length > 0) {
        // Actualizar faltante existente
        await pool.query(
          this.QUERIES.ACTUALIZAR_FALTANTE,
          [cantidadFaltante, faltanteExistente[0].id_faltante]
        );
        
        console.log(`✅ Faltante actualizado - ID: ${faltanteExistente[0].id_faltante}`);
        return {
          message: 'Faltante actualizado correctamente',
          id_faltante: faltanteExistente[0].id_faltante
        };
      }

      // Crear nuevo faltante
      const [result] = await pool.query(
        this.QUERIES.CREAR_FALTANTE,
        [productoId || null, varianteId || null, cantidadFaltante]
      );

      console.log(`✅ Faltante registrado - ID: ${result.insertId}`);
      return {
        message: 'Faltante registrado correctamente',
        id_faltante: result.insertId
      };
    } catch (error) {
      console.error('❌ Error en registrarFaltante:', error);
      throw error;
    }
  }

  /**
   * Marca un faltante como resuelto
   * @param {number} idFaltante - ID del faltante
   * @returns {Promise<void>}
   */
  static async resolverFaltante(idFaltante) {
    console.log(`✅ Resolviendo faltante ID: ${idFaltante}...`);
    
    try {
      const [result] = await pool.query(this.QUERIES.RESOLVER_FALTANTE, [idFaltante]);
      
      if (result.affectedRows === 0) {
        throw new Error('Faltante no encontrado.');
      }

      console.log(`✅ Faltante resuelto correctamente - ID: ${idFaltante}`);
    } catch (error) {
      console.error(`❌ Error al resolver faltante ID ${idFaltante}:`, error);
      throw error;
    }
  }
}
