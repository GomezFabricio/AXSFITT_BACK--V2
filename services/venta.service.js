import { pool } from '../db.js';

/**
 * Servicio para gestionar operaciones relacionadas con ventas
 * Optimizado con Promise.all() y logging detallado
 */
export class VentaService {
  
  // ==================== QUERIES DEFINIDOS ====================
  
  static QUERIES = {
    // Query para obtener todas las ventas
    OBTENER_TODAS_VENTAS: `
      SELECT 
        v.venta_id,
        v.venta_fecha,
        v.venta_estado_pago,
        v.venta_estado_envio,
        v.venta_monto_total,
        v.venta_monto_descuento,
        v.venta_origen,
        CASE 
          WHEN v.cliente_id IS NOT NULL THEN CONCAT(p.persona_nombre, ' ', p.persona_apellido)
          ELSE CONCAT(ei.envinv_nombre, ' ', ei.envinv_apellido) 
        END AS cliente_nombre,
        (SELECT COUNT(*) FROM ventas_detalle vd WHERE vd.venta_id = v.venta_id) as cantidad_productos
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.cliente_id
      LEFT JOIN personas p ON c.persona_id = p.persona_id
      LEFT JOIN envios_invitados ei ON v.venta_id = ei.venta_id
      ORDER BY v.venta_fecha DESC
    `,

    // Query para obtener venta por ID
    OBTENER_VENTA_POR_ID: `
      SELECT 
        v.venta_id,
        v.cliente_id,
        v.cupon_id,
        v.venta_fecha,
        v.venta_estado_pago,
        v.venta_estado_envio,
        v.venta_monto_total,
        v.venta_monto_descuento,
        v.venta_origen,
        v.venta_nota
      FROM ventas v
      WHERE v.venta_id = ?
    `,

    // Query para obtener datos de invitado
    OBTENER_INVITADO: `
      SELECT 
        envinv_nombre,
        envinv_apellido,
        envinv_email,
        envinv_telefono,
        envinv_calle,
        envinv_numero,
        envinv_cp,
        envinv_piso,
        envinv_depto,
        envinv_ciudad,
        envinv_provincia
      FROM envios_invitados
      WHERE venta_id = ?
    `,

    // Query para obtener productos de una venta
    OBTENER_PRODUCTOS_VENTA: `
      SELECT 
        vd.vd_id,
        vd.vd_cantidad,
        vd.vd_precio_unitario,
        vd.vd_subtotal,
        vd.producto_id,
        COALESCE(p.producto_nombre, vd.producto_nombre) as producto_nombre,
        vd.variante_id,
        v.variante_sku,
        COALESCE(
          GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', '), 
          vd.variante_descripcion
        ) AS variante_descripcion,
        ip.imagen_url
      FROM ventas_detalle vd
      LEFT JOIN productos p ON vd.producto_id = p.producto_id
      LEFT JOIN variantes v ON vd.variante_id = v.variante_id
      LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
      LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
      LEFT JOIN imagenes_productos ip ON (
        CASE 
          WHEN v.imagen_id IS NOT NULL THEN ip.imagen_id = v.imagen_id
          ELSE ip.producto_id = p.producto_id AND ip.imagen_orden = 0
        END
      )
      WHERE vd.venta_id = ?
      GROUP BY vd.vd_id, vd.vd_cantidad, vd.vd_precio_unitario, vd.vd_subtotal, 
               vd.producto_id, vd.variante_id, v.variante_sku, ip.imagen_url
      ORDER BY vd.vd_id
    `,

    // Query para buscar productos sin término (productos destacados)
    BUSCAR_PRODUCTOS_SIN_TERMINO: `
      SELECT 
        p.producto_id,
        p.producto_nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        CASE
          WHEN EXISTS (SELECT 1 FROM variantes v WHERE v.producto_id = p.producto_id AND v.variante_estado = 'activo')
          THEN (
            SELECT COALESCE(SUM(s.cantidad), 0)
            FROM variantes v 
            LEFT JOIN stock s ON s.variante_id = v.variante_id
            WHERE v.producto_id = p.producto_id AND v.variante_estado = 'activo'
          )
          ELSE COALESCE(s.cantidad, 0) 
        END AS stock,
        ip.imagen_url
      FROM productos p
      LEFT JOIN stock s ON s.producto_id = p.producto_id AND s.variante_id IS NULL
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) FROM imagenes_productos WHERE producto_id = p.producto_id
      )
      WHERE p.producto_estado = 'activo' AND p.producto_visible = 1
      AND (p.producto_precio_venta IS NOT NULL OR EXISTS (
        SELECT 1 FROM variantes v 
        WHERE v.producto_id = p.producto_id AND v.variante_precio_venta IS NOT NULL AND v.variante_estado = 'activo'
      ))
      ORDER BY p.producto_id DESC
      LIMIT 20
    `,

    // Query para buscar productos con término
    BUSCAR_PRODUCTOS_CON_TERMINO: `
      SELECT 
        p.producto_id,
        p.producto_nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        CASE
          WHEN EXISTS (SELECT 1 FROM variantes v WHERE v.producto_id = p.producto_id AND v.variante_estado = 'activo')
          THEN (
            SELECT COALESCE(SUM(s.cantidad), 0)
            FROM variantes v 
            LEFT JOIN stock s ON s.variante_id = v.variante_id
            WHERE v.producto_id = p.producto_id AND v.variante_estado = 'activo'
          )
          ELSE COALESCE(s.cantidad, 0) 
        END AS stock,
        ip.imagen_url
      FROM productos p
      LEFT JOIN stock s ON s.producto_id = p.producto_id AND s.variante_id IS NULL
      LEFT JOIN imagenes_productos ip ON ip.producto_id = p.producto_id AND ip.imagen_orden = (
        SELECT MIN(imagen_orden) FROM imagenes_productos WHERE producto_id = p.producto_id
      )
      WHERE p.producto_estado = 'activo' AND p.producto_visible = 1
      AND (
        p.producto_nombre LIKE ? OR
        p.producto_sku LIKE ?
      )
      AND (p.producto_precio_venta IS NOT NULL OR EXISTS (
        SELECT 1 FROM variantes v 
        WHERE v.producto_id = p.producto_id AND v.variante_precio_venta IS NOT NULL AND v.variante_estado = 'activo'
      ))
      ORDER BY 
        CASE WHEN p.producto_nombre LIKE ? THEN 0 ELSE 1 END,
        p.producto_nombre
      LIMIT 20
    `,

    // Query para obtener variantes de un producto
    OBTENER_VARIANTES_PRODUCTO: `
      SELECT 
        v.variante_id,
        v.variante_precio_venta,
        v.variante_precio_oferta,
        v.variante_sku,
        COALESCE(s.cantidad, 0) AS stock,
        ip.imagen_url,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS descripcion
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ? AND v.variante_estado = 'activo'
      GROUP BY v.variante_id, v.variante_precio_venta, v.variante_precio_oferta, v.variante_sku, s.cantidad, ip.imagen_url
    `,

    // Query para obtener atributos de una variante
    OBTENER_ATRIBUTOS_VARIANTE: `
      SELECT 
        a.atributo_nombre, 
        vv.valor_nombre
      FROM valores_variantes vv
      JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE vv.variante_id = ?
    `,

    // Query para crear nueva venta
    CREAR_VENTA: `
      INSERT INTO ventas (
        cliente_id, cupon_id, venta_fecha, venta_estado_pago, venta_estado_envio,
        venta_monto_total, venta_monto_descuento, venta_origen, venta_metodo_pago,
        venta_metodo_envio, venta_notas, venta_costo_envio, venta_descuento_porcentaje,
        venta_descuento_monto, venta_impuestos, venta_subtotal
      ) VALUES (?, ?, NOW(), 'pendiente', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    // Query para crear envío de invitado
    CREAR_ENVIO_INVITADO: `
      INSERT INTO envios_invitados (
        venta_id, envinv_nombre, envinv_apellido, envinv_email, envinv_telefono,
        envinv_calle, envinv_numero, envinv_cp, envinv_piso, envinv_depto,
        envinv_ciudad, envinv_provincia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    // Query para crear detalle de venta
    CREAR_DETALLE_VENTA: `
      INSERT INTO ventas_detalle (
        venta_id, producto_id, variante_id, vd_cantidad, vd_precio_unitario,
        vd_subtotal, producto_nombre, variante_descripcion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,

    // Query para actualizar stock
    ACTUALIZAR_STOCK: `
      UPDATE stock 
      SET cantidad = cantidad - ? 
      WHERE variante_id = ?
    `,

    // Query para restaurar stock
    RESTAURAR_STOCK: `
      UPDATE stock 
      SET cantidad = cantidad + ? 
      WHERE variante_id = ?
    `,

    // Query para actualizar estado de pago
    ACTUALIZAR_ESTADO_PAGO: `
      UPDATE ventas 
      SET venta_estado_pago = ? 
      WHERE venta_id = ?
    `,

    // Query para actualizar estado de envío
    ACTUALIZAR_ESTADO_ENVIO: `
      UPDATE ventas 
      SET venta_estado_envio = ?
      WHERE venta_id = ?
    `,

    // Query para verificar stock
    VERIFICAR_STOCK: `
      SELECT COALESCE(cantidad, 0) as stock 
      FROM stock 
      WHERE variante_id = ?
    `,

    // Query para actualizar datos de venta
    ACTUALIZAR_DATOS_VENTA: `
      UPDATE ventas 
      SET venta_nota = ?, venta_origen = ?
      WHERE venta_id = ?
    `,

    // Query para obtener métricas
    OBTENER_METRICAS: `
      SELECT 
        COUNT(*) as total_ventas,
        SUM(venta_monto_total) as ingresos_totales,
        AVG(venta_monto_total) as venta_promedio,
        COUNT(CASE WHEN venta_estado_pago = 'pagado' THEN 1 END) as ventas_pagadas,
        COUNT(CASE WHEN venta_estado_pago = 'pendiente' THEN 1 END) as ventas_pendientes,
        COUNT(CASE WHEN venta_estado_envio = 'entregado' THEN 1 END) as ventas_entregadas,
        COUNT(CASE WHEN DATE(venta_fecha) = CURDATE() THEN 1 END) as ventas_hoy,
        COUNT(CASE WHEN YEARWEEK(venta_fecha, 1) = YEARWEEK(CURDATE(), 1) THEN 1 END) as ventas_semana,
        COUNT(CASE WHEN MONTH(venta_fecha) = MONTH(CURDATE()) AND YEAR(venta_fecha) = YEAR(CURDATE()) THEN 1 END) as ventas_mes
      FROM ventas
    `,

    // Query para buscar ventas por fechas
    BUSCAR_VENTAS_POR_FECHAS: `
      SELECT 
        v.venta_id,
        v.venta_fecha,
        v.venta_estado_pago,
        v.venta_estado_envio,
        v.venta_monto_total,
        COALESCE(c.cliente_nombre, ei.envinv_nombre) as cliente_nombre,
        COALESCE(c.cliente_apellido, ei.envinv_apellido) as cliente_apellido,
        COALESCE(c.cliente_email, ei.envinv_email) as cliente_email
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.cliente_id
      LEFT JOIN envios_invitados ei ON v.venta_id = ei.venta_id
      WHERE v.venta_fecha BETWEEN ? AND ?
      ORDER BY v.venta_fecha DESC
    `,

    // Query para buscar ventas por cliente
    BUSCAR_VENTAS_POR_CLIENTE: `
      SELECT 
        v.venta_id,
        v.venta_fecha,
        v.venta_estado_pago,
        v.venta_estado_envio,
        v.venta_monto_total,
        v.venta_origen,
        v.venta_metodo_pago,
        v.venta_metodo_envio
      FROM ventas v
      WHERE v.cliente_id = ?
      ORDER BY v.venta_fecha DESC
    `,

    // Query para obtener detalle de venta
    OBTENER_DETALLE_VENTA: `
      SELECT 
        v.*,
        c.cliente_nombre,
        c.cliente_apellido,
        c.cliente_email,
        c.cliente_telefono,
        c.cliente_direccion,
        ei.envinv_nombre,
        ei.envinv_apellido,
        ei.envinv_email,
        ei.envinv_telefono,
        ei.envinv_calle,
        ei.envinv_numero,
        ei.envinv_cp,
        ei.envinv_piso,
        ei.envinv_depto,
        ei.envinv_ciudad,
        ei.envinv_provincia,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'producto_id', vd.producto_id,
            'variante_id', vd.variante_id,
            'cantidad', vd.vd_cantidad,
            'precio_unitario', vd.vd_precio_unitario,
            'subtotal', vd.vd_subtotal,
            'producto_nombre', COALESCE(p.producto_nombre, vd.producto_nombre),
            'variante_descripcion', vd.variante_descripcion,
            'producto_sku', p.producto_sku,
            'variante_sku', var.variante_sku
          )
        ) as productos
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.cliente_id
      LEFT JOIN envios_invitados ei ON v.venta_id = ei.venta_id
      LEFT JOIN ventas_detalle vd ON v.venta_id = vd.venta_id
      LEFT JOIN productos p ON vd.producto_id = p.producto_id
      LEFT JOIN variantes var ON vd.variante_id = var.variante_id
      WHERE v.venta_id = ?
      GROUP BY v.venta_id
    `
  };

  // ==================== MÉTODOS DEL SERVICIO ====================
  // ==================== MÉTODOS DEL SERVICIO ====================

  /**
   * Obtiene todas las ventas con información básica
   * @returns {Promise<Array>} Lista de ventas
   */
  static async obtenerTodasLasVentas() {
    console.log('🔍 Obteniendo todas las ventas...');
    
    const [ventas] = await pool.query(this.QUERIES.OBTENER_TODAS_VENTAS);
    
    console.log(`✅ Ventas obtenidas exitosamente: ${ventas.length} registros`);
    return ventas;
  }

  /**
   * Obtiene detalles completos de una venta por su ID
   * @param {number} ventaId - ID de la venta
   * @returns {Promise<Object>} Detalles de la venta
   */
  static async obtenerVentaPorId(ventaId) {
    console.log(`🔍 Obteniendo detalles de venta ID: ${ventaId}`);
    
    const conn = await pool.getConnection();
    
    try {
      // 1. Obtener datos principales de la venta
      const [venta] = await conn.query(this.QUERIES.OBTENER_VENTA_POR_ID, [ventaId]);
      
      if (venta.length === 0) {
        console.log(`❌ Venta no encontrada: ${ventaId}`);
        return null;
      }

      const resultado = venta[0];

      // 2. Obtener información del cliente (registrado o invitado)
      if (resultado.cliente_id) {
        // Cliente registrado
        const [cliente] = await conn.query(`
          SELECT 
            c.cliente_id,
            p.persona_nombre,
            p.persona_apellido,
            p.persona_dni,
            p.persona_telefono,
            p.persona_domicilio,
            c.cliente_email
          FROM clientes c
          JOIN personas p ON c.persona_id = p.persona_id
          WHERE c.cliente_id = ?
        `, [resultado.cliente_id]);
        
        if (cliente.length > 0) {
          resultado.cliente = cliente[0];
        }
      } else {
        // Cliente invitado (datos de envío)
        const [invitado] = await conn.query(this.QUERIES.OBTENER_INVITADO, [ventaId]);
        
        if (invitado.length > 0) {
          resultado.cliente = {
            nombre: invitado[0].envinv_nombre,
            apellido: invitado[0].envinv_apellido,
            email: invitado[0].envinv_email,
            telefono: invitado[0].envinv_telefono
          };
          
          resultado.envio = {
            calle: invitado[0].envinv_calle,
            numero: invitado[0].envinv_numero,
            cp: invitado[0].envinv_cp,
            piso: invitado[0].envinv_piso,
            depto: invitado[0].envinv_depto,
            ciudad: invitado[0].envinv_ciudad,
            provincia: invitado[0].envinv_provincia
          };
        }
      }

      // 3. Obtener productos de la venta
      const [productos] = await conn.query(this.QUERIES.OBTENER_PRODUCTOS_VENTA, [ventaId]);
      resultado.productos = productos;

      console.log(`✅ Detalles de venta obtenidos exitosamente: ${ventaId}`);
      return resultado;
    } finally {
      conn.release();
    }
  }

  /**
   * Crea una nueva venta con todos sus detalles
   * @param {Object} datosVenta - Objeto con venta, productos, cliente_invitado y envio
   * @param {Object} datosVenta.venta - Datos de la venta
   * @param {Array} datosVenta.productos - Array de productos
   * @param {Object} datosVenta.cliente_invitado - Datos del cliente invitado (opcional)
   * @param {Object} datosVenta.envio - Datos de envío (opcional)
   * @returns {Promise<Object>} Resultado de la creación
   */
  static async crearVenta(datosVenta) {
    console.log('📝 Creando nueva venta...');
    
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      const { venta, productos, cliente_invitado, envio } = datosVenta;
      
      // Si no hay cliente_id pero hay datos del cliente invitado, crear el cliente
      let clienteId = venta.cliente_id;
      
      if (!clienteId && cliente_invitado) {
        console.log('Creando nuevo cliente:', cliente_invitado);
        
        // 1. Insertar la persona
        const [personaResult] = await conn.query(
          `INSERT INTO personas (
            persona_nombre, 
            persona_apellido, 
            persona_dni, 
            persona_telefono,
            persona_fecha_alta
          ) VALUES (?, ?, ?, ?, CURDATE())`,
          [
            cliente_invitado.nombre,
            cliente_invitado.apellido,
            cliente_invitado.dni || null,
            cliente_invitado.telefono || null
          ]
        );
        
        const personaId = personaResult.insertId;
        
        // 2. Crear el cliente asociado a la persona
        const [clienteResult] = await conn.query(
          `INSERT INTO clientes (
            persona_id,
            cliente_email,
            cliente_fecha_alta
          ) VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [
            personaId,
            cliente_invitado.email
          ]
        );
        
        clienteId = clienteResult.insertId;
        console.log(`Nuevo cliente creado con ID: ${clienteId}`);
      }

      // Crear la venta principal
      const [ventaResult] = await conn.query(
        `INSERT INTO ventas (
          cliente_id,
          cupon_id,
          venta_estado_pago,
          venta_estado_envio,
          venta_monto_total,
          venta_monto_descuento,
          venta_origen,
          venta_nota
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clienteId,
          venta.cupon_id || null,
          venta.venta_estado_pago || 'pendiente',
          venta.venta_estado_envio || 'pendiente',
          venta.venta_monto_total,
          venta.venta_monto_descuento || 0,
          venta.venta_origen || 'Venta Manual',
          venta.venta_nota || null
        ]
      );

      const ventaId = ventaResult.insertId;

      // Insertar productos en ventas_detalle y actualizar stock
      for (const producto of productos) {
        const subtotal = producto.cantidad * producto.precio_unitario;
        
        // Obtener información adicional para respaldo
        let producto_nombre = null;
        let variante_descripcion = null;
        
        if (producto.variante_id) {
          // Obtener información de la variante para respaldo
          const [varianteInfo] = await conn.query(
            `SELECT 
              p.producto_nombre,
              GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') as descripcion
             FROM variantes v
             JOIN productos p ON v.producto_id = p.producto_id
             LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
             LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
             WHERE v.variante_id = ?
             GROUP BY p.producto_nombre`,
            [producto.variante_id]
          );
          
          if (varianteInfo.length > 0) {
            producto_nombre = varianteInfo[0].producto_nombre;
            variante_descripcion = varianteInfo[0].descripcion;
          }
          
          // Si tiene variante_id, insertamos SOLO la variante (producto_id debe ser NULL)
          await conn.query(
            `INSERT INTO ventas_detalle (
              venta_id,
              producto_id,
              variante_id,
              combo_id,
              vd_cantidad,
              vd_precio_unitario,
              vd_subtotal,
              producto_nombre,
              variante_descripcion
            ) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?)`,
            [
              ventaId,
              producto.variante_id,
              producto.cantidad,
              producto.precio_unitario,
              subtotal,
              producto_nombre,
              variante_descripcion
            ]
          );

          // Actualizar stock de variante SIEMPRE
          await conn.query(
            `UPDATE stock SET cantidad = GREATEST(0, cantidad - ?) WHERE variante_id = ?`,
            [producto.cantidad, producto.variante_id]
          );
        } else {
          // Obtener información del producto
          const [productoInfo] = await conn.query(
            `SELECT producto_nombre FROM productos WHERE producto_id = ?`,
            [producto.producto_id]
          );
          
          if (productoInfo.length > 0) {
            producto_nombre = productoInfo[0].producto_nombre;
          }
          
          // Si no tiene variante, insertamos SOLO el producto (variante_id debe ser NULL)
          await conn.query(
            `INSERT INTO ventas_detalle (
              venta_id,
              producto_id,
              variante_id,
              combo_id,
              vd_cantidad,
              vd_precio_unitario,
              vd_subtotal,
              producto_nombre
            ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?)`,
            [
              ventaId,
              producto.producto_id,
              producto.cantidad,
              producto.precio_unitario,
              subtotal,
              producto_nombre
            ]
          );

          // Actualizar stock de producto SIEMPRE
          await conn.query(
            `UPDATE stock SET cantidad = GREATEST(0, cantidad - ?) WHERE producto_id = ? AND variante_id IS NULL`,
            [producto.cantidad, producto.producto_id]
          );
        }
      }

      // Si hay datos de envío, crear registro de envío
      if (envio) {
        await conn.query(
          `INSERT INTO envios_invitados (
            venta_id,
            envinv_nombre,
            envinv_apellido,
            envinv_email,
            envinv_telefono,
            envinv_calle,
            envinv_numero,
            envinv_cp,
            envinv_piso,
            envinv_depto,
            envinv_ciudad,
            envinv_provincia
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ventaId,
            cliente_invitado?.nombre || 'N/A',
            cliente_invitado?.apellido || 'N/A',
            cliente_invitado?.email || 'N/A',
            cliente_invitado?.telefono || 'N/A',
            envio.calle,
            envio.numero,
            envio.cp,
            envio.piso || null,
            envio.depto || null,
            envio.ciudad,
            envio.provincia
          ]
        );
      }

      await conn.commit();
      
      console.log(`✅ Venta creada exitosamente con ID: ${ventaId}`);
      return {
        message: 'Venta creada exitosamente',
        venta_id: ventaId,
        cliente_id: clienteId
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualiza el estado de pago de una venta
   * @param {number} ventaId - ID de la venta
   * @param {string} estadoPago - Nuevo estado de pago
   * @returns {Promise<boolean>} Resultado de la actualización
   */
  static async actualizarEstadoPago(ventaId, estadoPago) {
    console.log(`🔄 Actualizando estado de pago venta ${ventaId}: ${estadoPago}`);
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Obtener el estado actual de la venta
      const [ventaActual] = await connection.query(this.QUERIES.OBTENER_VENTA_POR_ID, [ventaId]);
      
      if (!ventaActual || ventaActual.length === 0) {
        throw new Error('Venta no encontrada');
      }
      
      const estadoActual = ventaActual[0].venta_estado_pago;
      const estadoEnvioActual = ventaActual[0].venta_estado_envio;
      const fechaVenta = new Date(ventaActual[0].venta_fecha);
      const ahora = new Date();
      
      // Validar que no se pueda cambiar desde "cancelado" a otros estados
      if (estadoActual === 'cancelado' && estadoPago !== 'cancelado') {
        throw new Error('No se puede cambiar el estado desde "cancelado" a otro estado');
      }
      
      // Validar restricción de 24 horas para cancelación
      if (estadoPago === 'cancelado' && estadoActual !== 'cancelado') {
        const diferenciaHoras = (ahora - fechaVenta) / (1000 * 60 * 60);
        if (diferenciaHoras > 24) {
          throw new Error('No se puede cancelar el estado de pago después de 24 horas desde la venta');
        }
      }
      
      // Si se está cambiando a "cancelado", restaurar stock
      if (estadoPago === 'cancelado' && estadoActual !== 'cancelado') {
        console.log('🔄 Restaurando stock por cancelación de pago...');
        
        // Obtener productos de la venta
        const [productos] = await connection.query(this.QUERIES.OBTENER_PRODUCTOS_VENTA, [ventaId]);
        
        // Restaurar stock para cada producto
        for (const producto of productos) {
          if (producto.variante_id) {
            await connection.query(this.QUERIES.RESTAURAR_STOCK, [
              producto.vd_cantidad,
              producto.variante_id
            ]);
            console.log(`✅ Stock restaurado: ${producto.vd_cantidad} unidades para variante ${producto.variante_id}`);
          }
        }
      }
      
      // Actualizar el estado de pago
      const [result] = await connection.query(this.QUERIES.ACTUALIZAR_ESTADO_PAGO, [
        estadoPago, 
        ventaId
      ]);
      
      // SINCRONIZACIÓN AUTOMÁTICA: Si se cancela el pago, cancelar también el envío
      if (estadoPago === 'cancelado' && estadoEnvioActual !== 'cancelado') {
        await connection.query(this.QUERIES.ACTUALIZAR_ESTADO_ENVIO, [
          'cancelado', 
          ventaId
        ]);
        console.log('📋 Estado de envío cambiado automáticamente a "cancelado" por cancelación de pago');
      }
      
      await connection.commit();
      
      const actualizado = result.affectedRows > 0;
      console.log(actualizado ? '✅ Estado de pago actualizado con éxito' : '❌ No se pudo actualizar el estado de pago');
      
      return actualizado;
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error al actualizar estado de pago:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Actualiza el estado de envío de una venta
   * @param {number} ventaId - ID de la venta
   * @param {string} estadoEnvio - Nuevo estado de envío
   * @param {string} numeroSeguimiento - Número de seguimiento (opcional)
   * @returns {Promise<boolean>} Resultado de la actualización
   */
  static async actualizarEstadoEnvio(ventaId, estadoEnvio, numeroSeguimiento = null) {
    console.log(`🔄 Actualizando estado de envío venta ${ventaId}: ${estadoEnvio}`);
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Obtener el estado actual de la venta
      const [ventaActual] = await connection.query(this.QUERIES.OBTENER_VENTA_POR_ID, [ventaId]);
      
      if (!ventaActual || ventaActual.length === 0) {
        throw new Error('Venta no encontrada');
      }
      
      const estadoActual = ventaActual[0].venta_estado_envio;
      const estadoPagoActual = ventaActual[0].venta_estado_pago;
      
      // Validar que no se pueda cambiar desde "cancelado" a otros estados
      if (estadoActual === 'cancelado' && estadoEnvio !== 'cancelado') {
        throw new Error('No se puede cambiar el estado desde "cancelado" a otro estado');
      }
      
      // Si se está cambiando a "cancelado", restaurar stock
      if (estadoEnvio === 'cancelado' && estadoActual !== 'cancelado') {
        console.log('🔄 Restaurando stock por cancelación de envío...');
        
        // Obtener productos de la venta
        const [productos] = await connection.query(this.QUERIES.OBTENER_PRODUCTOS_VENTA, [ventaId]);
        
        // Restaurar stock para cada producto
        for (const producto of productos) {
          if (producto.variante_id) {
            await connection.query(this.QUERIES.RESTAURAR_STOCK, [
              producto.vd_cantidad,
              producto.variante_id
            ]);
            console.log(`✅ Stock restaurado: ${producto.vd_cantidad} unidades para variante ${producto.variante_id}`);
          }
        }
      }
      
      // Actualizar el estado de envío
      const [result] = await connection.query(this.QUERIES.ACTUALIZAR_ESTADO_ENVIO, [
        estadoEnvio, 
        ventaId
      ]);
      
      // SINCRONIZACIÓN AUTOMÁTICA: Si se cancela el envío, cancelar también el pago
      if (estadoEnvio === 'cancelado' && estadoPagoActual !== 'cancelado') {
        await connection.query(this.QUERIES.ACTUALIZAR_ESTADO_PAGO, [
          'cancelado', 
          ventaId
        ]);
        console.log('📋 Estado de pago cambiado automáticamente a "cancelado" por cancelación de envío');
      }
      
      await connection.commit();
      
      const actualizado = result.affectedRows > 0;
      console.log(actualizado ? '✅ Estado de envío actualizado con éxito' : '❌ No se pudo actualizar el estado de envío');
      
      return actualizado;
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error al actualizar estado de envío:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Busca productos para venta
   * @param {string} termino - Término de búsqueda
   * @param {number} categoriaId - ID de categoría (opcional)
   * @returns {Promise<Array>} Lista de productos
   */
  static async buscarProductosParaVenta(termino, categoriaId = null) {
    console.log(`🔍 Buscando productos para venta: ${termino}`);
    
    // Si no hay término de búsqueda, devolver productos destacados
    if (!termino) {
      const [productos] = await pool.query(this.QUERIES.BUSCAR_PRODUCTOS_SIN_TERMINO);
      console.log(`✅ Productos destacados obtenidos: ${productos.length}`);
      return productos;
    }
    
    // Búsqueda por término
    const [productos] = await pool.query(this.QUERIES.BUSCAR_PRODUCTOS_CON_TERMINO, [
      `%${termino}%`, 
      `%${termino}%`, 
      `${termino}%`
    ]);
    
    console.log(`✅ Productos encontrados: ${productos.length}`);
    return productos;
  }

  /**
   * Obtiene variantes de un producto
   * @param {number} productoId - ID del producto
   * @returns {Promise<Array>} Lista de variantes
   */
  static async obtenerVariantesProducto(productoId) {
    console.log(`🔍 Obteniendo variantes del producto: ${productoId}`);
    
    const [variantes] = await pool.query(this.QUERIES.OBTENER_VARIANTES_PRODUCTO, [productoId]);
    
    // Para cada variante, obtener sus atributos como pares clave-valor
    for (const variante of variantes) {
      const [atributos] = await pool.query(this.QUERIES.OBTENER_ATRIBUTOS_VARIANTE, [variante.variante_id]);
      
      // Crear un objeto con los atributos
      const atributosObj = {};
      atributos.forEach(attr => {
        atributosObj[attr.atributo_nombre] = attr.valor_nombre;
      });
      
      variante.atributos = atributosObj;
    }
    
    console.log(`✅ Variantes obtenidas: ${variantes.length}`);
    return variantes;
  }

  /**
   * Verifica disponibilidad de stock
   * @param {Array} productos - Lista de productos a verificar
   * @returns {Promise<Object>} Resultado de la verificación
   */
  static async verificarStock(productos) {
    console.log('🔍 Verificando stock de productos...');
    
    const verificaciones = await Promise.all(
      productos.map(async (producto) => {
        let stock = 0;
        
        if (producto.variante_id) {
          // Verificar stock de variante
          const [result] = await pool.query(
            `SELECT COALESCE(cantidad, 0) as stock FROM stock WHERE variante_id = ?`,
            [producto.variante_id]
          );
          stock = result.length > 0 ? result[0].stock : 0;
        } else {
          // Verificar stock de producto
          const [result] = await pool.query(
            `SELECT COALESCE(cantidad, 0) as stock FROM stock WHERE producto_id = ? AND variante_id IS NULL`,
            [producto.producto_id]
          );
          stock = result.length > 0 ? result[0].stock : 0;
        }
        
        const disponible = stock >= producto.cantidad;
        
        return {
          producto_id: producto.producto_id,
          variante_id: producto.variante_id || null,
          cantidad_solicitada: producto.cantidad,
          stock_disponible: stock,
          disponible
        };
      })
    );
    
    const todosDisponibles = verificaciones.every(v => v.disponible);
    
    console.log(`✅ Verificación de stock completada. Todos disponibles: ${todosDisponibles}`);
    return {
      todosDisponibles,
      resultados: verificaciones
    };
  }

  /**
   * Actualiza datos de una venta
   * @param {number} ventaId - ID de la venta
   * @param {Object} datosVenta - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la actualización
   */
  static async actualizarDatosVenta(ventaId, datosVenta) {
    console.log(`🔄 Actualizando datos de venta: ${ventaId}`);
    
    const {
      venta_nota,
      venta_origen
    } = datosVenta;
    
    const [result] = await pool.query(this.QUERIES.ACTUALIZAR_DATOS_VENTA, [
      venta_nota,
      venta_origen,
      ventaId
    ]);

    const actualizado = result.affectedRows > 0;
    console.log(actualizado ? '✅ Datos de venta actualizados' : '❌ No se pudieron actualizar los datos');
    
    return actualizado;
  }

  /**
   * Obtiene métricas de ventas para dashboard
   * @returns {Promise<Object>} Métricas de ventas
   */
  static async obtenerMetricasVentas() {
    console.log('📊 Obteniendo métricas de ventas...');
    
    const conn = await pool.getConnection();
    
    try {
      // 1. Resumen de ventas general
      const [resumenGeneral] = await conn.query(`
        SELECT 
          COUNT(*) as total_ventas,
          SUM(venta_monto_total) as ingresos_totales,
          AVG(venta_monto_total) as ticket_promedio,
          (
            SELECT COUNT(*) 
            FROM ventas 
            WHERE venta_estado_pago = 'abonado'
          ) as ventas_completadas,
          (
            SELECT COUNT(*) 
            FROM ventas 
            WHERE venta_estado_pago = 'pendiente'
          ) as ventas_pendientes,
          (
            SELECT COUNT(*) 
            FROM ventas 
            WHERE venta_estado_pago = 'cancelado'
          ) as ventas_canceladas
        FROM ventas
      `);
      
      // 2. Ventas por mes (últimos 6 meses)
      const [ventasPorMes] = await conn.query(`
        SELECT 
          DATE_FORMAT(venta_fecha, '%Y-%m') as mes,
          COUNT(*) as cantidad_ventas,
          SUM(venta_monto_total) as ingresos
        FROM ventas
        WHERE venta_fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(venta_fecha, '%Y-%m')
        ORDER BY mes ASC
      `);
      
      // 3. Ventas por origen
      const [ventasPorOrigen] = await conn.query(`
        SELECT 
          venta_origen,
          COUNT(*) as cantidad_ventas,
          SUM(venta_monto_total) as ingresos_totales
        FROM ventas
        GROUP BY venta_origen
        ORDER BY cantidad_ventas DESC
      `);
      
      // 4. Productos más vendidos
      const [productosMasVendidos] = await conn.query(`
        SELECT 
          COALESCE(p.producto_nombre, vd.producto_nombre) as producto_nombre,
          SUM(vd.vd_cantidad) as unidades_vendidas,
          SUM(vd.vd_subtotal) as ingresos_generados
        FROM ventas_detalle vd
        LEFT JOIN productos p ON vd.producto_id = p.producto_id
        JOIN ventas v ON vd.venta_id = v.venta_id
        WHERE v.venta_estado_pago != 'cancelado'
        GROUP BY COALESCE(p.producto_nombre, vd.producto_nombre)
        ORDER BY unidades_vendidas DESC
        LIMIT 10
      `);
      
      const resultado = {
        resumen: resumenGeneral[0],
        ventasPorMes,
        ventasPorOrigen,
        productosMasVendidos
      };
      
      console.log('✅ Métricas obtenidas exitosamente');
      return resultado;
    } finally {
      conn.release();
    }
  }

  /**
   * Busca ventas por rango de fechas
   * @param {Date} fechaDesde - Fecha de inicio
   * @param {Date} fechaHasta - Fecha de fin
   * @returns {Promise<Array>} Lista de ventas
   */
  static async buscarVentasPorFechas(fechaDesde, fechaHasta) {
    console.log(`🔍 Buscando ventas entre ${fechaDesde} y ${fechaHasta}`);
    
    const [ventas] = await pool.query(this.QUERIES.BUSCAR_VENTAS_POR_FECHAS, [fechaDesde, fechaHasta]);
    
    console.log(`✅ Ventas encontradas: ${ventas.length}`);
    return ventas;
  }

  /**
   * Busca ventas por cliente
   * @param {number} clienteId - ID del cliente
   * @returns {Promise<Array>} Lista de ventas del cliente
   */
  static async buscarVentasPorCliente(clienteId) {
    console.log(`🔍 Buscando ventas del cliente: ${clienteId}`);
    
    const [ventas] = await pool.query(this.QUERIES.BUSCAR_VENTAS_POR_CLIENTE, [clienteId]);
    
    console.log(`✅ Ventas encontradas: ${ventas.length}`);
    return ventas;
  }

  /**
   * Obtiene el detalle de una venta
   * @param {number} ventaId - ID de la venta
   * @returns {Promise<Object>} Detalle de la venta
   */
  static async obtenerDetalleVenta(ventaId) {
    console.log(`🔍 Obteniendo detalle de venta: ${ventaId}`);
    
    const [detalle] = await pool.query(this.QUERIES.OBTENER_DETALLE_VENTA, [ventaId]);
    
    const resultado = detalle.length > 0 ? detalle[0] : null;
    console.log(resultado ? '✅ Detalle obtenido' : '❌ Venta no encontrada');
    
    return resultado;
  }
}

export default VentaService;
