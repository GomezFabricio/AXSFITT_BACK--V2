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

    // Obtener variantes de un producto específico (SIN DUPLICADOS)
    OBTENER_VARIANTES_PRODUCTO: `
      SELECT DISTINCT
        v.variante_id,
        v.variante_sku,
        COALESCE(MAX(s.cantidad), 0) AS stock_total,
        MAX(ip.imagen_url) AS imagen_url,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos_concatenados,
        -- Mantener compatibilidad con código existente
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT vv.valor_nombre ORDER BY a.atributo_nombre), ',', 1) AS valor_nombre,
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT a.atributo_nombre ORDER BY a.atributo_nombre), ',', 1) AS atributo_nombre,
        v.variante_estado,
        COALESCE(MAX(s.stock_minimo), 0) AS stock_minimo,
        COALESCE(MAX(s.stock_maximo), NULL) AS stock_maximo
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ?
      GROUP BY v.variante_id, v.variante_sku, v.variante_estado
      ORDER BY v.variante_id
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
        f.faltante_cantidad_faltante,
        ip.imagen_url,
        'producto' AS tipo,
        f.faltante_id,
        f.faltante_fecha_deteccion
      FROM faltantes f
      JOIN productos p ON f.faltante_producto_id = p.producto_id
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      LEFT JOIN categorias c ON p.categoria_id = c.categoria_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) 
        FROM imagenes_productos 
        WHERE producto_id = p.producto_id
      )
      WHERE f.faltante_resuelto = FALSE AND f.faltante_producto_id IS NOT NULL
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
        f.faltante_cantidad_faltante,
        ip.imagen_url,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
        'variante' AS tipo,
        f.faltante_id,
        f.faltante_fecha_deteccion
      FROM faltantes f
      JOIN variantes v ON f.faltante_variante_id = v.variante_id
      JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE f.faltante_resuelto = FALSE AND f.faltante_variante_id IS NOT NULL
      GROUP BY v.variante_id, p.producto_nombre, v.variante_sku, s.cantidad, s.stock_minimo, s.stock_maximo, ip.imagen_url, f.faltante_id, f.faltante_fecha_deteccion
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
          WHERE f.faltante_producto_id = p.producto_id AND f.faltante_resuelto = FALSE
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
          WHERE f.faltante_variante_id = v.variante_id AND f.faltante_resuelto = FALSE
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
      UPDATE faltantes SET faltante_estado = 'resuelto', faltante_resuelto = TRUE WHERE faltante_id = ?
    `,

    // Marcar faltante como pedido
    PEDIR_FALTANTE: `
      UPDATE faltantes SET faltante_estado = 'pedido_generado' WHERE faltante_id = ?
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
   * Obtiene todos los faltantes detectados usando la estructura actualizada de BD
   * @returns {Promise<Array>} Lista de faltantes con información completa
   */
  static async obtenerFaltantes() {
    console.log('� Obteniendo faltantes desde base de datos actualizada...');
    
    try {
      const [faltantes] = await pool.query(`
        SELECT 
          f.faltante_id,
          f.faltante_fecha_deteccion,
          f.faltante_cantidad_original,
          f.faltante_cantidad_faltante,
          f.faltante_cantidad_solicitada,
          f.faltante_estado,
          f.faltante_resuelto,
          f.faltante_producto_id,
          f.faltante_variante_id,
          f.faltante_pedido_id,
          
          -- Información del producto (si es faltante directo de producto)
          p.producto_nombre as producto_directo_nombre,
          
          -- Información del producto de variante (si es faltante de variante)
          p2.producto_nombre as producto_variante_nombre,
          
          -- Información de la variante
          v.variante_id as variante_info_id,
          v.variante_precio_venta,
          v.variante_sku,
          
          -- Información del stock actual
          s.cantidad as stock_actual,
          s.stock_minimo,
          s.stock_maximo,
          s.ubicacion,
          
          -- Nombre completo de la variante con valores
          GROUP_CONCAT(vv.valor_nombre SEPARATOR ', ') as valores_variante,
          
          -- Nombre del producto construido con variantes reales
          CASE 
            WHEN f.faltante_producto_id IS NOT NULL THEN p.producto_nombre
            WHEN f.faltante_variante_id IS NOT NULL THEN 
              CASE 
                WHEN GROUP_CONCAT(vv.valor_nombre SEPARATOR ', ') IS NOT NULL THEN
                  CONCAT(p2.producto_nombre, ' - ', GROUP_CONCAT(vv.valor_nombre SEPARATOR ', '))
                ELSE
                  CONCAT(p2.producto_nombre, ' (Sin variantes)')
              END
            ELSE 'Producto no identificado'
          END AS producto_nombre,
          
          -- Estado del stock
          CASE 
            WHEN s.cantidad = 0 THEN 'SIN_STOCK'
            WHEN s.cantidad < s.stock_minimo THEN 'CRITICO'
            WHEN s.cantidad <= (s.stock_minimo * 1.2) THEN 'BAJO'
            ELSE 'NORMAL'
          END AS estado_stock,
          
          -- Información de notificaciones relacionadas
          COUNT(DISTINCT np.id) as notificaciones_enviadas
          
        FROM faltantes f
        
        -- Join con productos directos
        LEFT JOIN productos p ON f.faltante_producto_id = p.producto_id
        
        -- Join con variantes y sus productos
        LEFT JOIN variantes v ON f.faltante_variante_id = v.variante_id
        LEFT JOIN productos p2 ON v.producto_id = p2.producto_id
        
        -- Join con valores de variantes para obtener nombres reales
        LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
        
        -- Join con stock actual
        LEFT JOIN stock s ON (
          (f.faltante_producto_id IS NOT NULL AND s.producto_id = f.faltante_producto_id) OR
          (f.faltante_variante_id IS NOT NULL AND s.variante_id = f.faltante_variante_id)
        )
        
        -- Join con notificaciones pendientes para saber si ya se notificó
        LEFT JOIN notificaciones_pendientes np ON np.faltante_id = f.faltante_id
        
        GROUP BY f.faltante_id, f.faltante_fecha_deteccion, f.faltante_cantidad_original, 
                 f.faltante_cantidad_faltante, f.faltante_cantidad_solicitada, f.faltante_estado, 
                 f.faltante_resuelto, f.faltante_producto_id, f.faltante_variante_id, 
                 f.faltante_pedido_id, p.producto_nombre, p2.producto_nombre, 
                 v.variante_id, v.variante_precio_venta, v.variante_sku,
                 s.cantidad, s.stock_minimo, s.stock_maximo, s.ubicacion
        
        ORDER BY 
          f.faltante_resuelto ASC,
          f.faltante_fecha_deteccion DESC
      `);
      
      console.log(`✅ ${faltantes.length} faltantes encontrados`);
      
      // Procesar los datos para agregar información adicional
      const faltantesConInfo = faltantes.map(faltante => ({
        ...faltante,
        // Calcular días desde detección
        dias_desde_deteccion: Math.floor((Date.now() - new Date(faltante.faltante_fecha_deteccion)) / (1000 * 60 * 60 * 24)),
        
        // Calcular porcentaje de cobertura actual
        porcentaje_cobertura: faltante.stock_minimo > 0 
          ? Math.round((faltante.stock_actual / faltante.stock_minimo) * 100)
          : 0,
          
        // Información de urgencia
        urgencia: faltante.stock_actual === 0 ? 'CRITICA' 
          : faltante.stock_actual < faltante.stock_minimo ? 'ALTA'
          : 'MEDIA',
          
        // Estado de notificaciones
        notificado: faltante.notificaciones_enviadas > 0
      }));
      
      return faltantesConInfo;
      
    } catch (error) {
      console.error('❌ Error obteniendo faltantes:', error);
      throw new Error(`Error al obtener faltantes: ${error.message}`);
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

  /**
   * Marca un faltante como pedido
   * @param {number} idFaltante - ID del faltante
   * @returns {Promise<void>}
   */
  static async pedirFaltante(idFaltante) {
    console.log(`📦 Marcando faltante como pedido - ID: ${idFaltante}...`);
    
    try {
      const [result] = await pool.query(this.QUERIES.PEDIR_FALTANTE, [idFaltante]);
      
      if (result.affectedRows === 0) {
        throw new Error('Faltante no encontrado.');
      }

      console.log(`📦 Faltante marcado como pedido correctamente - ID: ${idFaltante}`);
    } catch (error) {
      console.error(`❌ Error al marcar faltante como pedido ID ${idFaltante}:`, error);
      throw error;
    }
  }
}
