import { pool } from '../db.js';

/**
 * Servicio para gestión de Carrito de Pedido Rápido
 * Centraliza la lógica de negocio para el manejo de carritos de reposición
 */

class CarritoPedidosService {

  /**
   * Obtener información completa de un producto para el carrito
   * @param {number} producto_id 
   * @returns {Object} Información del producto
   */
  static async obtenerInfoProducto(producto_id) {
    const [rows] = await pool.query(`
      SELECT 
        p.producto_id,
        p.producto_nombre,
        s.cantidad as stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        ip.imagen_url
      FROM productos p
      LEFT JOIN stock s ON s.producto_id = p.producto_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = 1
      WHERE p.producto_id = ? AND p.producto_estado = 'activo'
    `, [producto_id]);

    return rows.length ? { ...rows[0], tipo: 'producto' } : null;
  }

  /**
   * Obtener información completa de una variante para el carrito
   * @param {number} variante_id 
   * @returns {Object} Información de la variante
   */
  static async obtenerInfoVariante(variante_id) {
    const [rows] = await pool.query(`
      SELECT 
        v.variante_id,
        p.producto_id,
        p.producto_nombre,
        v.variante_sku,
        v.variante_precio_venta,
        s.cantidad as stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
        ip.imagen_url
      FROM variantes v
      JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      WHERE v.variante_id = ? AND v.variante_estado = 'activo'
      GROUP BY v.variante_id
    `, [variante_id]);

    return rows.length ? { ...rows[0], tipo: 'variante' } : null;
  }

  /**
   * Obtener todos los faltantes pendientes para agregar al carrito
   * @returns {Array} Lista de faltantes
   */
  static async obtenerFaltantesPendientes() {
    const [faltantes] = await pool.query(`
      SELECT 
        f.faltante_id,
        f.faltante_producto_id as producto_id,
        f.faltante_variante_id as variante_id,
        f.faltante_cantidad_faltante as cantidad_faltante,
        
        -- Información del producto
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            (SELECT p2.producto_nombre FROM variantes v2 JOIN productos p2 ON v2.producto_id = p2.producto_id WHERE v2.variante_id = f.faltante_variante_id)
          WHEN f.faltante_producto_id IS NOT NULL THEN 
            p.producto_nombre
          ELSE 'Producto no identificado'
        END AS producto_nombre,
        
        -- Información de la variante (si aplica)
        v.variante_sku,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
        
        -- Stock actual y mínimo
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            COALESCE((SELECT s2.cantidad FROM stock s2 WHERE s2.variante_id = f.faltante_variante_id), 0)
          WHEN f.faltante_producto_id IS NOT NULL THEN 
            COALESCE((SELECT s2.cantidad FROM stock s2 WHERE s2.producto_id = f.faltante_producto_id), 0)
          ELSE 0
        END AS stock_actual,
        
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            COALESCE((SELECT s2.stock_minimo FROM stock s2 WHERE s2.variante_id = f.faltante_variante_id), 0)
          WHEN f.faltante_producto_id IS NOT NULL THEN 
            COALESCE((SELECT s2.stock_minimo FROM stock s2 WHERE s2.producto_id = f.faltante_producto_id), 0)
          ELSE 0
        END AS stock_minimo,
        
        -- Imagen
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN ip2.imagen_url
          WHEN f.faltante_producto_id IS NOT NULL THEN ip.imagen_url
          ELSE NULL
        END AS imagen_url,
        
        -- Precio estimado
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            COALESCE((SELECT v2.variante_precio_venta FROM variantes v2 WHERE v2.variante_id = f.faltante_variante_id), 0)
          ELSE 0
        END AS precio_estimado
        
      FROM faltantes f
      LEFT JOIN productos p ON f.faltante_producto_id = p.producto_id
      LEFT JOIN variantes v ON f.faltante_variante_id = v.variante_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = 1
      LEFT JOIN imagenes_productos ip2 ON ip2.imagen_id = v.imagen_id
      
      WHERE f.faltante_resuelto = FALSE 
        AND f.faltante_estado IN ('detectado', 'pendiente')
      
      GROUP BY f.faltante_id
      ORDER BY f.faltante_fecha_deteccion DESC
    `);

    return faltantes;
  }

  /**
   * Calcular cantidad faltante recomendada
   * @param {number} stock_actual 
   * @param {number} stock_minimo 
   * @param {number} stock_maximo 
   * @returns {number} Cantidad recomendada
   */
  static calcularCantidadRecomendada(stock_actual, stock_minimo, stock_maximo = null) {
    // Si hay stock máximo definido, reponer hasta el máximo
    if (stock_maximo && stock_maximo > stock_minimo) {
      return Math.max(0, stock_maximo - stock_actual);
    }
    
    // Si no hay stock máximo, reponer el doble del mínimo menos el actual
    const reposicionBase = Math.max(0, (stock_minimo * 2) - stock_actual);
    
    // Mínimo reponer lo que falta para llegar al stock mínimo
    const minimoNecesario = Math.max(0, stock_minimo - stock_actual);
    
    return Math.max(reposicionBase, minimoNecesario);
  }

  /**
   * Actualizar estado de un faltante según la cantidad pedida
   * @param {number} faltante_id 
   * @param {number} cantidad_pedida 
   * @param {number} cantidad_faltante 
   * @param {number} pedido_id 
   * @param {Object} conn - Conexión de base de datos
   */
  static async actualizarEstadoFaltante(faltante_id, cantidad_pedida, cantidad_faltante, pedido_id, conn) {
    let nuevoEstado;
    
    if (cantidad_pedida >= cantidad_faltante) {
      nuevoEstado = 'solicitado_completo';
    } else {
      nuevoEstado = 'solicitado_parcial';
    }

    await conn.query(`
      UPDATE faltantes 
      SET faltante_estado = ?,
          faltante_cantidad_solicitada = ?,
          faltante_pedido_id = ?
      WHERE faltante_id = ?
    `, [nuevoEstado, cantidad_pedida, pedido_id, faltante_id]);

    console.log(`✅ Faltante ${faltante_id} actualizado a estado: ${nuevoEstado}`);
  }

  /**
   * Validar datos del carrito antes de crear pedido
   * @param {Array} items - Items del carrito
   * @param {number} proveedor_id 
   * @throws {Error} Si hay errores de validación
   */
  static validarDatosCarrito(items, proveedor_id) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('El carrito está vacío');
    }

    if (!proveedor_id) {
      throw new Error('Debe seleccionar un proveedor');
    }

    // Validar cada item
    items.forEach((item, index) => {
      if (!item.producto_id && !item.variante_id) {
        throw new Error(`Item ${index + 1}: Debe especificar producto_id o variante_id`);
      }

      if (!item.cantidad || item.cantidad <= 0) {
        throw new Error(`Item ${index + 1}: La cantidad debe ser mayor a 0`);
      }

      if (item.cantidad > 10000) {
        throw new Error(`Item ${index + 1}: La cantidad es excesiva (máximo 10,000)`);
      }
    });
  }

  /**
   * Verificar si un proveedor está activo
   * @param {number} proveedor_id 
   * @returns {Object|null} Información del proveedor
   */
  static async verificarProveedor(proveedor_id) {
    const [proveedor] = await pool.query(
      'SELECT proveedor_id, proveedor_nombre, proveedor_estado FROM proveedores WHERE proveedor_id = ?',
      [proveedor_id]
    );

    if (!proveedor.length) {
      return null;
    }

    if (proveedor[0].proveedor_estado !== 'activo') {
      throw new Error('El proveedor seleccionado no está activo');
    }

    return proveedor[0];
  }

  /**
   * Obtener estadísticas del carrito
   * @param {Array} items - Items del carrito
   * @returns {Object} Estadísticas
   */
  static calcularEstadisticasCarrito(items) {
    if (!items || !items.length) {
      return {
        total_items: 0,
        total_cantidad: 0,
        total_estimado: 0,
        items_criticos: 0,
        items_variantes: 0,
        items_productos: 0
      };
    }

    return {
      total_items: items.length,
      total_cantidad: items.reduce((sum, item) => sum + item.cantidad, 0),
      total_estimado: items.reduce((sum, item) => sum + (item.cantidad * (item.precio_estimado || 0)), 0),
      items_criticos: items.filter(item => item.stock_actual === 0).length,
      items_variantes: items.filter(item => item.tipo === 'variante').length,
      items_productos: items.filter(item => item.tipo === 'producto').length
    };
  }

  /**
   * Generar observaciones automáticas para el pedido
   * @param {Array} items - Items del carrito
   * @returns {string} Texto de observaciones
   */
  static generarObservacionesPedido(items) {
    const estadisticas = this.calcularEstadisticasCarrito(items);
    
    let observaciones = `Pedido generado automáticamente desde carrito rápido de faltantes.\n`;
    observaciones += `Total de productos: ${estadisticas.total_items}\n`;
    observaciones += `Cantidad total: ${estadisticas.total_cantidad} unidades\n`;
    
    if (estadisticas.items_criticos > 0) {
      observaciones += `⚠️ URGENTE: ${estadisticas.items_criticos} productos sin stock\n`;
    }

    if (estadisticas.items_variantes > 0) {
      observaciones += `Incluye ${estadisticas.items_variantes} variantes específicas\n`;
    }

    observaciones += `Fecha de generación: ${new Date().toLocaleString('es-ES')}`;

    return observaciones;
  }
}

export default CarritoPedidosService;