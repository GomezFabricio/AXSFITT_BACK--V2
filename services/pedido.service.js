/**
 * Servicio para gestión de pedidos
 * - Métodos CRUD
 * - Precarga de productos sin registrar
 * - Recepción de pedidos (actualiza stock, precios, historial)
 * - Usa tablas: pedidos, pedidos_detalle, pedidos_modificaciones, stock, stock_movimientos, precios_historicos
 * - Sigue lineamientos: modularidad, contratos claros, sin lógica en controller
 */
import { pool } from '../db.js';

class PedidoService {
  // ==================== QUERIES ESTÁTICAS ====================
  static QUERIES = {
    OBTENER_PEDIDOS: `SELECT * FROM pedidos ORDER BY pedido_fecha_pedido DESC`,
    OBTENER_PEDIDOS_DETALLADO: `
      SELECT p.pedido_id, p.pedido_fecha_pedido, p.pedido_estado, p.pedido_total, p.pedido_descuento, p.pedido_costo_envio, p.pedido_fecha_esperada_entrega,
             pr.proveedor_id, pr.proveedor_nombre,
             u.usuario_id,
             per.persona_nombre, per.persona_apellido
      FROM pedidos p
      LEFT JOIN proveedores pr ON p.pedido_proveedor_id = pr.proveedor_id
      LEFT JOIN usuarios u ON p.pedido_usuario_id = u.usuario_id
      LEFT JOIN personas per ON u.persona_id = per.persona_id
      ORDER BY p.pedido_fecha_pedido DESC
    `,
    OBTENER_PEDIDO_POR_ID: 'SELECT * FROM pedidos WHERE pedido_id = ?',
    OBTENER_PEDIDO_CABECERA: `
      SELECT p.*, pr.proveedor_nombre, u.usuario_id, per.persona_nombre, per.persona_apellido
      FROM pedidos p
      LEFT JOIN proveedores pr ON p.pedido_proveedor_id = pr.proveedor_id
      LEFT JOIN usuarios u ON p.pedido_usuario_id = u.usuario_id
      LEFT JOIN personas per ON u.persona_id = per.persona_id
      WHERE p.pedido_id = ?
    `,
    OBTENER_PEDIDO_ITEMS: `
      SELECT d.pd_id, d.pd_producto_id, d.pd_variante_id, d.pd_cantidad_pedida, d.pd_precio_unitario, d.pd_subtotal,
        COALESCE(p.producto_nombre, (
          SELECT p2.producto_nombre FROM variantes v2 JOIN productos p2 ON v2.producto_id = p2.producto_id WHERE v2.variante_id = d.pd_variante_id LIMIT 1
        )) as producto_nombre,
        v.variante_precio_venta, v.variante_precio_costo,
        v.variante_sku, v.variante_id,
        (
          SELECT GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ')
          FROM valores_variantes vv
          JOIN atributos a ON vv.atributo_id = a.atributo_id
          WHERE vv.variante_id = d.pd_variante_id
        ) AS variante_atributos
      FROM pedidos_detalle d
      LEFT JOIN productos p ON d.pd_producto_id = p.producto_id
      LEFT JOIN variantes v ON d.pd_variante_id = v.variante_id
      WHERE d.pd_pedido_id = ?
    `,
    // OBTENER_PEDIDO_SIN_REGISTRAR eliminado: ahora se usa pedidos_borrador_producto
    CREAR_PEDIDO: `INSERT INTO pedidos (
      pedido_proveedor_id,
      pedido_usuario_id,
      pedido_estado,
      pedido_fecha_pedido,
      pedido_total,
      pedido_descuento,
      pedido_costo_envio,
      pedido_fecha_esperada_entrega
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    CREAR_DETALLE: `INSERT INTO pedidos_detalle (pd_pedido_id, pd_producto_id, pd_cantidad_pedida, pd_precio_unitario) VALUES (?, ?, ?, ?)`,
    ACTUALIZAR_PEDIDO: (campos) => `UPDATE pedidos SET ${campos.join(', ')} WHERE pedido_id = ?`,
    ELIMINAR_PEDIDO: `UPDATE pedidos SET pedido_estado = 'cancelado' WHERE pedido_id = ?`,
    RECEPCIONAR_PEDIDO: `UPDATE pedidos SET pedido_estado = 'recibido', pedido_fecha_recepcion = ? WHERE pedido_id = ?`,
    CREAR_MODIFICACION: `INSERT INTO pedidos_modificaciones (pedido_id, usuario_id, descripcion, fecha) VALUES (?, ?, ?, ?)`
  };

  /**
   * Obtiene todos los pedidos
   */
  async obtenerPedidosDetallado() {
    const [rows] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDOS_DETALLADO);
    return rows;
  }
  
  // Mantener el método original para compatibilidad
  async obtenerPedidos() {
    const [rows] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDOS);
    return rows;
  }

  /**
   * Obtiene un pedido por ID con todo el detalle (cabecera, ítems, totales, descuentos, variantes, productos sin registrar)
   */
  async obtenerPedidoPorId(id) {
    // 1. Cabecera del pedido
    const [cabeceraRows] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDO_CABECERA, [id]);
    if (!cabeceraRows.length) return null;
    const pedido = cabeceraRows[0];

    // 2. Ítems del pedido (productos y variantes)
    const [items] = await pool.query(PedidoService.QUERIES.OBTENER_PEDIDO_ITEMS, [id]);

    // 3. Productos sin registrar: ahora se obtienen de pedidos_borrador_producto (ya se consulta más abajo)
    const sinRegistrar = [];

    // 4. Variantes en borrador
    const [variantesBorrador] = await pool.query(`
      SELECT vb.*, p.producto_nombre
      FROM variantes_borrador vb
      LEFT JOIN productos p ON vb.vb_producto_id = p.producto_id
      WHERE vb.vb_pedido_id = ?
    `, [id]);
    // Parsear atributos JSON si corresponde
    variantesBorrador.forEach(vb => {
      try {
        vb.vb_atributos = typeof vb.vb_atributos === 'string' ? JSON.parse(vb.vb_atributos) : vb.vb_atributos;
      } catch (e) {}
    });

    // 5. Productos borrador (sin registrar, tabla nueva)
    const [productosBorrador] = await pool.query(`
      SELECT * FROM pedidos_borrador_producto WHERE pbp_pedido_id = ?
    `, [id]);
    
    // Parsear atributos y variantes JSON si corresponde
    productosBorrador.forEach(pb => {
      try {
        // Parsear atributos JSON
        if (pb.pbp_atributos && typeof pb.pbp_atributos === 'string') {
          pb.pbp_atributos = JSON.parse(pb.pbp_atributos);
        }
        // Parsear variantes JSON
        if (pb.pbp_variantes && typeof pb.pbp_variantes === 'string') {
          pb.pbp_variantes = JSON.parse(pb.pbp_variantes);
        }
      } catch (e) {
        console.warn('Error al parsear JSON en productos borrador:', e);
        // Si falla el parseo, mantener los valores originales
      }
    });

    // 6. Subtotal calculado (solo ítems registrados y borrador)
    const subtotal = [...items, ...variantesBorrador].reduce((acc, item) => {
      const cantidad = item.pd_cantidad_pedida || item.vb_cantidad || 0;
      const precio = item.pd_precio_unitario || item.vb_precio_unitario || 0;
      const subtotalItem = item.pd_subtotal || (precio * cantidad);
      return acc + Number(subtotalItem || 0);
    }, 0) + 
    // Calcular subtotal de productos borrador considerando variantes
    productosBorrador.reduce((acc, pb) => {
      // Si el producto tiene variantes, calcular basado en las variantes
      if (pb.pbp_variantes && Array.isArray(pb.pbp_variantes) && pb.pbp_variantes.length > 0) {
        const subtotalVariantes = pb.pbp_variantes.reduce((accVariantes, variante) => {
          return accVariantes + ((Number(variante.precio) || 0) * (Number(variante.cantidad) || 0));
        }, 0);
        return acc + subtotalVariantes;
      } else {
        // Producto sin variantes, usar precio base
        const cantidad = Number(pb.pbp_cantidad) || 0;
        const precio = Number(pb.pbp_precio_unitario) || 0;
        return acc + (precio * cantidad);
      }
    }, 0);

    // 7. Calcular descuento como porcentaje
    const descuentoPorcentaje = Number(pedido.pedido_descuento) || 0;
    const descuentoCalculado = subtotal * (descuentoPorcentaje / 100);
    const costoEnvio = Number(pedido.pedido_costo_envio) || 0;
    const totalCalculado = subtotal - descuentoCalculado + costoEnvio;

    // 8. Retornar objeto completo
    return {
      ...pedido,
      items,
      // productosSinRegistrar: sinRegistrar, // ya no se usa, se mantiene para compatibilidad si es necesario
      variantesBorrador,
      productosBorrador,
      subtotal,
      descuento: descuentoPorcentaje,
      descuentoCalculado,
      costo_envio: costoEnvio,
      total: Number(pedido.pedido_total) || totalCalculado
    };
  }

  /**
   * Validar estructura de datos enviados desde frontend
   * @param {Object} data - Datos del pedido
   */
  async validarEstructuraDatos(data) {
    const errores = [];
    
    // Validar proveedor
    if (!data.proveedor_id) {
      errores.push('proveedor_id es requerido');
    } else {
      const [proveedor] = await pool.query('SELECT proveedor_id FROM proveedores WHERE proveedor_id = ? AND proveedor_estado = "activo"', [data.proveedor_id]);
      if (proveedor.length === 0) {
        errores.push('Proveedor no existe o está inactivo');
      }
    }

    // Validar productos registrados
    if (data.productos && Array.isArray(data.productos)) {
      for (let i = 0; i < data.productos.length; i++) {
        const prod = data.productos[i];
        if (!prod.producto_id) {
          errores.push(`Producto ${i + 1}: producto_id es requerido`);
        }
        if (!prod.cantidad || prod.cantidad <= 0) {
          errores.push(`Producto ${i + 1}: cantidad debe ser mayor a 0`);
        }
        if (prod.precio_costo !== undefined && (typeof prod.precio_costo !== 'number' || prod.precio_costo < 0)) {
          errores.push(`Producto ${i + 1}: precio_costo debe ser un número positivo`);
        }
        
        // Verificar que el producto existe
        if (prod.producto_id) {
          const [producto] = await pool.query('SELECT producto_id FROM productos WHERE producto_id = ?', [prod.producto_id]);
          if (producto.length === 0) {
            errores.push(`Producto ${i + 1}: producto_id ${prod.producto_id} no existe`);
          }
        }

        // Verificar variante si existe
        if (prod.variante_id) {
          const [variante] = await pool.query('SELECT variante_id FROM variantes WHERE variante_id = ? AND producto_id = ?', [prod.variante_id, prod.producto_id]);
          if (variante.length === 0) {
            errores.push(`Producto ${i + 1}: variante_id ${prod.variante_id} no existe para el producto ${prod.producto_id}`);
          }
        }
      }
    }

    // Validar variantes borrador
    if (data.variantesBorrador && Array.isArray(data.variantesBorrador)) {
      for (let i = 0; i < data.variantesBorrador.length; i++) {
        const vb = data.variantesBorrador[i];
        if (!vb.vb_producto_id) {
          errores.push(`Variante borrador ${i + 1}: vb_producto_id es requerido`);
        }
        if (!vb.vb_cantidad || vb.vb_cantidad <= 0) {
          errores.push(`Variante borrador ${i + 1}: vb_cantidad debe ser mayor a 0`);
        }
        if (!vb.vb_precio_unitario || vb.vb_precio_unitario < 0) {
          errores.push(`Variante borrador ${i + 1}: vb_precio_unitario debe ser un número positivo`);
        }
        if (!vb.vb_atributos || !Array.isArray(vb.vb_atributos) || vb.vb_atributos.length === 0) {
          errores.push(`Variante borrador ${i + 1}: vb_atributos debe ser un array no vacío`);
        }
      }
    }

    // Validar productos borrador
    if (data.productosBorrador && Array.isArray(data.productosBorrador)) {
      for (let i = 0; i < data.productosBorrador.length; i++) {
        const pb = data.productosBorrador[i];
        if (!pb.pbp_nombre || pb.pbp_nombre.trim() === '') {
          errores.push(`Producto borrador ${i + 1}: pbp_nombre es requerido`);
        }
        
        // Verificar si el producto tiene variantes
        const tieneVariantes = pb.pbp_variantes && Array.isArray(pb.pbp_variantes) && pb.pbp_variantes.length > 0;
        
        if (tieneVariantes) {
          // Para productos con variantes, validar que las variantes tengan datos válidos
          let variantesValidas = true;
          for (let j = 0; j < pb.pbp_variantes.length; j++) {
            const variante = pb.pbp_variantes[j];
            if (!variante.cantidad || variante.cantidad <= 0) {
              errores.push(`Producto borrador ${i + 1}, variante ${j + 1}: cantidad debe ser mayor a 0`);
              variantesValidas = false;
            }
            if (!variante.precio || variante.precio <= 0) {
              errores.push(`Producto borrador ${i + 1}, variante ${j + 1}: precio debe ser mayor a 0`);
              variantesValidas = false;
            }
          }
          
          // Para productos con variantes, la cantidad y precio base pueden ser 0
          if (!variantesValidas) {
            errores.push(`Producto borrador ${i + 1}: las variantes deben tener cantidad y precio válidos`);
          }
        } else {
          // Para productos sin variantes, validar cantidad y precio base
          if (!pb.pbp_cantidad || pb.pbp_cantidad <= 0) {
            errores.push(`Producto borrador ${i + 1}: pbp_cantidad debe ser mayor a 0`);
          }
          if (!pb.pbp_precio_unitario || pb.pbp_precio_unitario <= 0) {
            errores.push(`Producto borrador ${i + 1}: pbp_precio_unitario debe ser un número positivo`);
          }
        }
      }
    }

    if (errores.length > 0) {
      throw new Error(`Errores de validación: ${errores.join(', ')}`);
    }

    return true;
  }

  /**
   * Comparar precios y registrar cambios en historial
   * @param {Object} data - Datos del pedido
   * @param {number} pedido_id - ID del pedido
   * @param {number} usuario_id - ID del usuario
   * @param {Object} conn - Conexión de base de datos
   */
  async compararYRegistrarPrecios(data, pedido_id, usuario_id, conn) {
    try {
      // Comparar precios de productos registrados
      if (data.productos && Array.isArray(data.productos)) {
        for (const prod of data.productos) {
          if (prod.precio_costo !== undefined) {
            let precioActual = null;
            let producto_id = prod.producto_id;
            let variante_id = prod.variante_id || null;

            // Obtener precio actual
            if (prod.variante_id) {
              const [variante] = await conn.query('SELECT variante_precio_costo FROM variantes WHERE variante_id = ?', [prod.variante_id]);
              if (variante.length > 0) {
                precioActual = variante[0].variante_precio_costo;
              }
            } else {
              const [producto] = await conn.query('SELECT producto_precio_costo FROM productos WHERE producto_id = ?', [prod.producto_id]);
              if (producto.length > 0) {
                precioActual = producto[0].producto_precio_costo;
              }
            }

            // Si hay diferencia de precio, registrar en historial
            if (precioActual !== null && precioActual !== prod.precio_costo) {
              await conn.query(`
                INSERT INTO precios_historicos (
                  ph_producto_id, ph_variante_id, ph_precio_costo_anterior, ph_precio_costo_nuevo,
                  ph_motivo, ph_pedido_id, ph_usuario_id, ph_observaciones
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                producto_id,
                variante_id,
                precioActual,
                prod.precio_costo,
                'recepcion_pedido',
                pedido_id,
                usuario_id,
                `Cambio de precio detectado en pedido. Precio anterior: $${precioActual}, Precio nuevo: $${prod.precio_costo}`
              ]);

              // Actualizar precio en la tabla correspondiente
              if (prod.variante_id) {
                await conn.query('UPDATE variantes SET variante_precio_costo = ? WHERE variante_id = ?', [prod.precio_costo, prod.variante_id]);
              } else {
                await conn.query('UPDATE productos SET producto_precio_costo = ? WHERE producto_id = ?', [prod.precio_costo, prod.producto_id]);
              }
            }
          }
        }
      }

      // Registrar precios de variantes borrador para futuro seguimiento
      // NOTA: No registramos en precios_historicos para variantes borrador
      // hasta que se conviertan en variantes oficiales, ya que ph_variante_id no puede ser NULL
      if (data.variantesBorrador && Array.isArray(data.variantesBorrador)) {
        console.log('📝 Variantes borrador no se registran en precios_historicos hasta ser variantes oficiales');
        // for (const vb of data.variantesBorrador) {
        //   Commented out: Will be handled when variant becomes official
        // }
      }

      // Registrar precios iniciales de productos borrador
      // NOTA: No registramos en precios_historicos para productos borrador
      // hasta que se conviertan en productos oficiales, ya que ph_producto_id no puede ser NULL
      if (data.productosBorrador && Array.isArray(data.productosBorrador)) {
        console.log('📝 Productos borrador no se registran en precios_historicos hasta ser productos oficiales');
        // for (const pb of data.productosBorrador) {
        //   Commented out: Will be handled when product becomes official
        // }
      }

    } catch (error) {
      throw error;
    }
  }

  /**
   * Crea un nuevo pedido y sus detalles
   * @param {Object} data - { proveedor_id, productos: [{producto_id, cantidad, precio_costo}], productosSinRegistrar: [{nombre, cantidad, precio_costo}] }
   */
  async crearPedido(data) {
    // Validar estructura de datos
    await this.validarEstructuraDatos(data);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const {
        proveedor_id,
        pedido_usuario_id,
        productos = [],
        productosSinRegistrar = [],
        variantesBorrador = [],
        productosBorrador = [],
        descuento = 0,
        costo_envio = 0,
        fecha_esperada_entrega = null,
        total = null
      } = data;

      const fechaPedido = new Date();
      // Calcular total si no viene
      let pedido_total = total;
      if (pedido_total === null) {
        // Productos registrados
        let subtotal = productos.reduce((acc, p) => acc + ((Number(p.precio_costo) || 0) * (Number(p.cantidad) || 1)), 0);
        
        // Productos sin registrar (legacy)
        subtotal += productosSinRegistrar.reduce((acc, p) => acc + ((Number(p.precio_costo) || 0) * (Number(p.cantidad) || 1)), 0);
        
        // Variantes borrador
        subtotal += variantesBorrador.reduce((acc, vb) => acc + ((Number(vb.vb_precio_unitario) || 0) * (Number(vb.vb_cantidad) || 1)), 0);
        
        // Productos borrador
        subtotal += productosBorrador.reduce((acc, pb) => {
          // Si el producto tiene variantes, calcular el subtotal basado en las variantes
          if (pb.pbp_variantes && Array.isArray(pb.pbp_variantes) && pb.pbp_variantes.length > 0) {
            const subtotalVariantes = pb.pbp_variantes.reduce((accVariantes, variante) => {
              return accVariantes + ((Number(variante.precio) || 0) * (Number(variante.cantidad) || 0));
            }, 0);
            console.log(`📊 Producto con variantes "${pb.pbp_nombre}": subtotal = ${subtotalVariantes}`);
            return acc + subtotalVariantes;
          } else {
            // Producto sin variantes, usar precio base
            const subtotalBase = (Number(pb.pbp_precio_unitario) || 0) * (Number(pb.pbp_cantidad) || 1);
            console.log(`📊 Producto sin variantes "${pb.pbp_nombre}": subtotal = ${subtotalBase}`);
            return acc + subtotalBase;
          }
        }, 0);
        
        // Agregar costo de envío al subtotal antes del descuento
        const subtotalConEnvio = subtotal + (Number(costo_envio) || 0);
        
        // Aplicar descuento al subtotal + envío
        const descuentoMonto = subtotalConEnvio * (Number(descuento) / 100);
        pedido_total = Math.max(0, subtotalConEnvio - descuentoMonto);
      }
      const [pedidoRes] = await conn.query(
        PedidoService.QUERIES.CREAR_PEDIDO,
        [
          proveedor_id,
          pedido_usuario_id,
          'pendiente',
          fechaPedido,
          pedido_total,
          descuento,
          costo_envio,
          fecha_esperada_entrega || null
        ]
      );
      const pedido_id = pedidoRes.insertId;

      // Guardar variantes en borrador
      console.log('🔍 VARIANTES BORRADOR RECIBIDAS:', JSON.stringify(variantesBorrador, null, 2));
      for (const vb of variantesBorrador) {
        console.log('📝 Insertando variante borrador:', vb);
        await conn.query(
          'INSERT INTO variantes_borrador (vb_pedido_id, vb_producto_id, vb_atributos, vb_cantidad, vb_precio_unitario, vb_estado) VALUES (?, ?, ?, ?, ?, ?)',
          [pedido_id, vb.vb_producto_id, JSON.stringify(vb.vb_atributos), vb.vb_cantidad, vb.vb_precio_unitario, 'borrador']
        );
        console.log('✅ Variante borrador insertada');
      }

      // Guardar productos en borrador
      console.log('🔍 PRODUCTOS BORRADOR RECIBIDOS:', JSON.stringify(productosBorrador, null, 2));
      for (const pb of productosBorrador) {
        console.log('📝 Insertando producto borrador:', pb);
        
        // Calcular precio unitario y cantidad para productos con variantes
        let cantidadTotal = pb.pbp_cantidad || 0;
        let precioUnitario = pb.pbp_precio_unitario || 0;
        
        if (pb.pbp_variantes && Array.isArray(pb.pbp_variantes) && pb.pbp_variantes.length > 0) {
          // Para productos con variantes, calcular totales
          cantidadTotal = pb.pbp_variantes.reduce((acc, variante) => acc + (Number(variante.cantidad) || 0), 0);
          const subtotalVariantes = pb.pbp_variantes.reduce((acc, variante) => {
            return acc + ((Number(variante.precio) || 0) * (Number(variante.cantidad) || 0));
          }, 0);
          precioUnitario = cantidadTotal > 0 ? (subtotalVariantes / cantidadTotal) : 0;
          console.log(`📊 Producto con variantes "${pb.pbp_nombre}": cantidad total = ${cantidadTotal}, precio promedio = ${precioUnitario}`);
        }
        
        await conn.query(
          'INSERT INTO pedidos_borrador_producto (pbp_pedido_id, pbp_nombre, pbp_atributos, pbp_variantes, pbp_cantidad, pbp_precio_unitario, pbp_estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [pedido_id, pb.pbp_nombre, JSON.stringify(pb.pbp_atributos || null), JSON.stringify(pb.pbp_variantes || null), cantidadTotal, precioUnitario, 'borrador']
        );
        console.log('✅ Producto borrador insertado');
      }

      // Detalles productos registrados
      for (const prod of productos) {
        if (prod.variante_id) {
          // Si tiene variante, guardar SOLO en pd_variante_id y dejar pd_producto_id en NULL
          await conn.query(
            'INSERT INTO pedidos_detalle (pd_pedido_id, pd_producto_id, pd_variante_id, pd_cantidad_pedida, pd_precio_unitario) VALUES (?, NULL, ?, ?, ?)',
            [pedido_id, prod.variante_id, prod.cantidad, prod.precio_costo]
          );
        } else {
          // Si no tiene variante, guardar SOLO producto y dejar variante en NULL
          await conn.query(
            'INSERT INTO pedidos_detalle (pd_pedido_id, pd_producto_id, pd_variante_id, pd_cantidad_pedida, pd_precio_unitario) VALUES (?, ?, NULL, ?, ?)',
            [pedido_id, prod.producto_id, prod.cantidad, prod.precio_costo]
          );
        }
      }

      // Detalles productos sin registrar (legacy) - convertir a productos borrador
      console.log('🔍 PROCESANDO PRODUCTOS SIN REGISTRAR:', JSON.stringify(productosSinRegistrar, null, 2));
      
      // Crear un Set con los nombres de productos que ya están en productosBorrador
      const productosYaEnBorrador = new Set(productosBorrador.map(pb => pb.pbp_nombre));
      
      for (const prod of productosSinRegistrar) {
        console.log('📝 Analizando producto sin registrar:', prod);
        
        // Mejorar el parsing de cantidad y precio
        const cantidad = prod.cantidad && prod.cantidad !== '' ? Number(prod.cantidad) : 0;
        const precio = prod.precio_costo && prod.precio_costo !== '' ? Number(prod.precio_costo) : 0;
        
        console.log(`   - Nombre: "${prod.nombre}"`);
        console.log(`   - Cantidad original: "${prod.cantidad}" -> parseada: ${cantidad}`);
        console.log(`   - Precio original: "${prod.precio_costo}" -> parseado: ${precio}`);
        
        // Si el producto tiene nombre, verificar si no está ya en productosBorrador
        if (prod.nombre && prod.nombre.trim() !== '') {
          if (productosYaEnBorrador.has(prod.nombre)) {
            console.log('📋 Producto ya está en productosBorrador, omitiendo duplicado:', prod.nombre);
            continue;
          }
          
          if (cantidad > 0 && precio > 0) {
            // Producto con datos completos
            await conn.query(
              'INSERT INTO pedidos_borrador_producto (pbp_pedido_id, pbp_nombre, pbp_atributos, pbp_variantes, pbp_cantidad, pbp_precio_unitario, pbp_estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                pedido_id, 
                prod.nombre, 
                JSON.stringify(prod.atributosConfigurados || null), 
                JSON.stringify([]), 
                cantidad, 
                precio, 
                'borrador'
              ]
            );
            console.log('✅ Producto sin registrar insertado como producto borrador:', prod.nombre);
          } else if (prod.atributosConfigurados && prod.atributosConfigurados.atributos && prod.atributosConfigurados.atributos.length > 0) {
            // Producto con atributos configurados pero sin cantidad/precio base
            // Solo guardarlo si no viene en productosBorrador con variantes
            console.log('📋 Producto con atributos configurados sin datos base, verificando si tiene variantes en productosBorrador');
            console.log('   - Este producto se manejará por variantes o ya está en productosBorrador');
          } else {
            console.log('⚠️ Producto sin registrar ignorado por no tener datos válidos:', prod.nombre);
          }
        } else {
          console.log('⚠️ Producto sin registrar ignorado por no tener nombre válido:', prod);
        }
      }

      // Comparar y registrar cambios de precios
      await this.compararYRegistrarPrecios(data, pedido_id, pedido_usuario_id, conn);

      await conn.commit();
      return pedido_id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Precarga producto sin registrar
   * @param {Object} data - { nombre, categoria_id, precio_costo, stock_inicial }
   */
  async precargarProductoSinRegistrar(data) {
    // Implementar según estructura de productos_sin_registrar
    // Ejemplo:
    const { nombre, categoria_id, precio_costo, stock_inicial } = data;
    const [res] = await pool.query(
      'INSERT INTO productos_sin_registrar (nombre, categoria_id, precio_costo, stock_inicial, estado) VALUES (?, ?, ?, ?, ?)',
      [nombre, categoria_id, precio_costo, stock_inicial, 'pendiente']
    );
    return res.insertId;
  }

  /**
   * Recepcionar pedido: actualiza cantidades recibidas, precios, stock y movimientos
   * MEJORADO: Incluye comparación de precios durante la recepción
   * @param {number} pedido_id
   * @param {Array} recepcion - [{detalle_id, cantidad_recibida, precio_costo_nuevo}]
   * @param {number} usuario_id
   */
  async recepcionarPedido(pedido_id, recepcion, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Actualizar estado pedido
      await conn.query('UPDATE pedidos SET pedido_estado = ?, pedido_fecha_entrega_real = ? WHERE pedido_id = ?', 
        ['recibido', new Date(), pedido_id]);

      // Actualizar detalles, stock y registrar cambios de precios
      for (const item of recepcion) {
        // Obtener información del detalle
        const [detalle] = await conn.query(
          'SELECT pd.*, p.producto_precio_costo, v.variante_precio_costo FROM pedidos_detalle pd LEFT JOIN productos p ON pd.pd_producto_id = p.producto_id LEFT JOIN variantes v ON pd.pd_variante_id = v.variante_id WHERE pd.pd_id = ?', 
          [item.detalle_id]
        );

        if (detalle.length === 0) continue;

        const det = detalle[0];
        const producto_id = det.pd_producto_id;
        const variante_id = det.pd_variante_id;

        // Actualizar detalle del pedido
        await conn.query(
          'UPDATE pedidos_detalle SET pd_cantidad_recibida = ?, pd_precio_unitario = ? WHERE pd_id = ?', 
          [item.cantidad_recibida, item.precio_costo_nuevo || det.pd_precio_unitario, item.detalle_id]
        );

        // Actualizar stock y crear movimiento
        if (producto_id || variante_id) {
          // Actualizar stock
          if (variante_id) {
            await conn.query(
              'INSERT INTO stock (variante_id, cantidad) VALUES (?, ?) ON DUPLICATE KEY UPDATE cantidad = cantidad + ?', 
              [variante_id, item.cantidad_recibida, item.cantidad_recibida]
            );
          } else {
            await conn.query(
              'INSERT INTO stock (producto_id, cantidad) VALUES (?, ?) ON DUPLICATE KEY UPDATE cantidad = cantidad + ?', 
              [producto_id, item.cantidad_recibida, item.cantidad_recibida]
            );
          }

          // Crear movimiento de stock
          await conn.query(
            'INSERT INTO stock_movimientos (sm_producto_id, sm_variante_id, sm_tipo_movimiento, sm_cantidad, sm_motivo, sm_pedido_id, sm_usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [producto_id, variante_id, 'entrada', item.cantidad_recibida, `Recepción pedido ${pedido_id}`, pedido_id, usuario_id]
          );

          // Comparar y registrar cambios de precios
          if (item.precio_costo_nuevo) {
            let precioActual = null;
            if (variante_id) {
              precioActual = det.variante_precio_costo;
            } else {
              precioActual = det.producto_precio_costo;
            }

            // Si hay cambio de precio, registrarlo
            if (precioActual !== null && precioActual !== item.precio_costo_nuevo) {
              await conn.query(`
                INSERT INTO precios_historicos (
                  ph_producto_id, ph_variante_id, ph_precio_costo_anterior, ph_precio_costo_nuevo,
                  ph_motivo, ph_pedido_id, ph_usuario_id, ph_observaciones
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                producto_id,
                variante_id,
                precioActual,
                item.precio_costo_nuevo,
                'recepcion_pedido',
                pedido_id,
                usuario_id,
                `Actualización de precio durante recepción. Cantidad recibida: ${item.cantidad_recibida}`
              ]);

              // Actualizar precio en la tabla correspondiente
              if (variante_id) {
                await conn.query('UPDATE variantes SET variante_precio_costo = ? WHERE variante_id = ?', 
                  [item.precio_costo_nuevo, variante_id]);
              } else {
                await conn.query('UPDATE productos SET producto_precio_costo = ? WHERE producto_id = ?', 
                  [item.precio_costo_nuevo, producto_id]);
              }
            }
          }
        }
      }

      // Migrar variantes borrador a tablas oficiales
      await this.migrarVariantesBorrador(pedido_id, usuario_id, conn);

      // Migrar productos borrador a tabla oficial de productos
      await this.migrarProductosBorrador(pedido_id, usuario_id, conn);

      // Registrar modificación
      await conn.query(
        'INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)',
        [pedido_id, usuario_id, 'Recepción de pedido con actualización de precios', 
         JSON.stringify({ estado: 'pendiente' }), JSON.stringify({ estado: 'recibido', fecha_recepcion: new Date() })]
      );

      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Migrar variantes borrador a tablas oficiales
   * @param {number} pedido_id
   * @param {number} usuario_id  
   * @param {Object} conn
   */
  async migrarVariantesBorrador(pedido_id, usuario_id, conn) {
    const [variantesBorrador] = await conn.query('SELECT * FROM variantes_borrador WHERE vb_pedido_id = ?', [pedido_id]);
    
    for (const vb of variantesBorrador) {
      // Parsear atributos
      let atributos = vb.vb_atributos;
      if (typeof atributos === 'string') {
        try {
          atributos = JSON.parse(atributos);
        } catch (e) {
          atributos = [];
        }
      }

      // Obtener o crear atributos del producto
      let atributoIds = {};
      if (Array.isArray(atributos)) {
        for (const attr of atributos) {
          let [rows] = await conn.query('SELECT atributo_id FROM atributos WHERE atributo_nombre = ? AND producto_id = ?', 
            [attr.atributo_nombre, vb.vb_producto_id]);
          
          let atributo_id;
          if (rows.length > 0) {
            atributo_id = rows[0].atributo_id;
          } else {
            let res = await conn.query('INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)', 
              [vb.vb_producto_id, attr.atributo_nombre]);
            atributo_id = res[0].insertId;
          }
          atributoIds[attr.atributo_nombre] = atributo_id;
        }
      }

      // Crear variante oficial (inicialmente inactiva)
      let resVar = await conn.query(
        'INSERT INTO variantes (producto_id, variante_estado, variante_precio_costo) VALUES (?, ?, ?)', 
        [vb.vb_producto_id, 'inactivo', vb.vb_precio_unitario]
      );
      let variante_id = resVar[0].insertId;

      // Crear valores de variante
      if (Array.isArray(atributos)) {
        for (const attr of atributos) {
          let atributo_id = atributoIds[attr.atributo_nombre];
          await conn.query(
            'INSERT INTO valores_variantes (variante_id, atributo_id, valor_nombre) VALUES (?, ?, ?)',
            [variante_id, atributo_id, attr.valor_nombre]
          );
        }
      }

      // Registrar en historial de precios
      await conn.query(`
        INSERT INTO precios_historicos (
          ph_producto_id, ph_variante_id, ph_precio_costo_anterior, ph_precio_costo_nuevo,
          ph_motivo, ph_pedido_id, ph_usuario_id, ph_observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vb.vb_producto_id,
        variante_id,
        null,
        vb.vb_precio_unitario,
        'recepcion_pedido',
        pedido_id,
        usuario_id,
        `Migración de variante borrador a variante oficial. Atributos: ${JSON.stringify(atributos)}`
      ]);

      // Marcar variante borrador como migrada
      await conn.query('UPDATE variantes_borrador SET vb_estado = ? WHERE vb_id = ?', ['registrado', vb.vb_id]);
    }
  }

  /**
   * Migrar productos borrador a tabla oficial
   * @param {number} pedido_id
   * @param {number} usuario_id
   * @param {Object} conn
   */
  async migrarProductosBorrador(pedido_id, usuario_id, conn) {
    const [productosBorrador] = await conn.query('SELECT * FROM pedidos_borrador_producto WHERE pbp_pedido_id = ?', [pedido_id]);
    
    for (const pb of productosBorrador) {
      // Crear producto oficial (inicialmente inactivo)
      let resProd = await conn.query(
        'INSERT INTO productos (producto_nombre, producto_estado, producto_precio_costo) VALUES (?, ?, ?)', 
        [pb.pbp_nombre, 'inactivo', pb.pbp_precio_unitario]
      );
      let producto_id = resProd[0].insertId;

      // Registrar precio inicial en historial
      await conn.query(`
        INSERT INTO precios_historicos (
          ph_producto_id, ph_variante_id, ph_precio_costo_anterior, ph_precio_costo_nuevo,
          ph_motivo, ph_pedido_id, ph_usuario_id, ph_observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        producto_id,
        null,
        null,
        pb.pbp_precio_unitario,
        'recepcion_pedido',
        pedido_id,
        usuario_id,
        `Migración de producto borrador a producto oficial: ${pb.pbp_nombre}`
      ]);

      // Marcar producto borrador como migrado
      await conn.query('UPDATE pedidos_borrador_producto SET pbp_estado = ? WHERE pbp_id = ?', ['registrado', pb.pbp_id]);
    }
  }

  // Métodos CRUD, edición, cancelación, historial, etc. pueden agregarse aquí siguiendo el patrón
  /**
   * Cancela un pedido: actualiza estado y registra motivo en pedidos_modificaciones
   * @param {number} pedido_id
   * @param {string} motivo_cancelacion
   * @param {number} usuario_id
   */
  async cancelarPedido(pedido_id, motivo_cancelacion, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Obtener detalle anterior
      const [pedidoAnt] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      // Actualizar estado
      await conn.query('UPDATE pedidos SET pedido_estado = ? WHERE pedido_id = ?', ['cancelado', pedido_id]);
      // Registrar modificación
      await conn.query(
        `INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)`,
        [
          pedido_id,
          usuario_id,
          motivo_cancelacion || 'Cancelación de pedido',
          JSON.stringify(pedidoAnt[0] || {}),
          JSON.stringify({ pedido_estado: 'cancelado' })
        ]
      );
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Modifica un pedido: actualiza campos y registra en pedidos_modificaciones
   * @param {number} pedido_id
   * @param {object} modificaciones - campos a modificar (ej: {pedido_estado, pedido_total, ...})
   * @param {number} usuario_id
   */
  /**
   * Modificar pedido y registrar en historial
   * @param {number} pedido_id
   * @param {Object} modificaciones
   * @param {number} usuario_id
   * @param {string} motivo
   */
  async modificarPedido(pedido_id, modificaciones, usuario_id, motivo = 'Modificación de pedido') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Validar que el pedido existe y está en estado pendiente
      const [pedidoExistente] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      if (!pedidoExistente.length) {
        throw new Error('Pedido no encontrado');
      }
      
      if (pedidoExistente[0].pedido_estado !== 'pendiente') {
        throw new Error('Solo se pueden modificar pedidos en estado pendiente');
      }

      // Obtener detalle anterior
      const pedidoAnterior = pedidoExistente[0];
      
      // Actualizar pedido
      const campos = Object.keys(modificaciones).map(c => `${c} = ?`);
      const valores = Object.values(modificaciones);
      
      if (campos.length > 0) {
        await conn.query(
          `UPDATE pedidos SET ${campos.join(', ')} WHERE pedido_id = ?`, 
          [...valores, pedido_id]
        );
      }
      
      // Obtener detalle nuevo
      const [pedidoNuevo] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      
      // Registrar modificación en historial
      await conn.query(
        `INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)`,
        [
          pedido_id,
          usuario_id,
          motivo,
          JSON.stringify(pedidoAnterior),
          JSON.stringify(pedidoNuevo[0])
        ]
      );
      
      await conn.commit();
      return { success: true, message: 'Pedido modificado exitosamente' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Obtener historial de modificaciones de un pedido
   * @param {number} pedido_id
   */
  async obtenerHistorialModificaciones(pedido_id) {
    try {
      const [historial] = await pool.query(`
        SELECT pm.*, p.persona_nombre, p.persona_apellido
        FROM pedidos_modificaciones pm
        LEFT JOIN usuarios u ON pm.pm_usuario_id = u.usuario_id
        LEFT JOIN personas p ON u.persona_id = p.persona_id
        WHERE pm.pm_pedido_id = ?
        ORDER BY pm.pm_fecha_modificacion DESC
      `, [pedido_id]);
      
      return historial.map(registro => ({
        ...registro,
        pm_detalle_anterior: JSON.parse(registro.pm_detalle_anterior || '{}'),
        pm_detalle_nuevo: JSON.parse(registro.pm_detalle_nuevo || '{}'),
        usuario_nombre: `${registro.persona_nombre || ''} ${registro.persona_apellido || ''}`.trim() || 'Usuario desconocido'
      }));
    } catch (err) {
      console.error('Error al obtener historial de modificaciones:', err);
      throw err;
    }
  }

  /**
   * Modificar pedido completo: actualiza cabecera, ítems, variantes borrador y productos borrador
   * @param {number} pedido_id
   * @param {Object} datosCompletos - todos los datos del pedido
   * @param {number} usuario_id
   * @param {string} motivo
   */
  async modificarPedidoCompleto(pedido_id, datosCompletos, usuario_id, motivo = 'Modificación completa de pedido') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      console.log('=== INICIO MODIFICAR PEDIDO COMPLETO ===');
      console.log('pedido_id:', pedido_id);
      console.log('datosCompletos:', JSON.stringify(datosCompletos, null, 2));
      
      // Validar que el pedido existe y está en estado pendiente
      const [pedidoExistente] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      if (!pedidoExistente.length) {
        throw new Error('Pedido no encontrado');
      }
      
      if (pedidoExistente[0].pedido_estado !== 'pendiente') {
        throw new Error('Solo se pueden modificar pedidos en estado pendiente');
      }

      // Obtener detalle anterior completo para historial
      console.log('Obteniendo pedido anterior...');
      // Usar conexión directa en lugar de this.obtenerPedidoPorId para evitar problemas con transacciones
      const [cabeceraAnterior] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      const [itemsAnteriores] = await conn.query('SELECT * FROM pedidos_detalle WHERE pd_pedido_id = ?', [pedido_id]);
      const [variantesBorradorAnteriores] = await conn.query('SELECT * FROM variantes_borrador WHERE vb_pedido_id = ?', [pedido_id]);
      const [productosBorradorAnteriores] = await conn.query('SELECT * FROM pedidos_borrador_producto WHERE pbp_pedido_id = ?', [pedido_id]);
      
      const pedidoAnterior = {
        ...cabeceraAnterior[0],
        items: itemsAnteriores,
        variantesBorrador: variantesBorradorAnteriores,
        productosBorrador: productosBorradorAnteriores
      };
      
      console.log('Items del pedido anterior:', pedidoAnterior?.items?.length || 0);
      
      const { modificaciones, itemsEliminados = [], variantesBorradorEliminadas = [], productosBorradorEliminados = [] } = datosCompletos;
      
      // 1. Actualizar campos básicos del pedido
      const camposBasicos = {};
      if (modificaciones.pedido_descuento !== undefined) camposBasicos.pedido_descuento = modificaciones.pedido_descuento;
      if (modificaciones.pedido_costo_envio !== undefined) camposBasicos.pedido_costo_envio = modificaciones.pedido_costo_envio;
      if (modificaciones.pedido_fecha_esperada_entrega !== undefined) camposBasicos.pedido_fecha_esperada_entrega = modificaciones.pedido_fecha_esperada_entrega;
      
      // 2. Eliminar ítems marcados para eliminación
      if (itemsEliminados.length > 0) {
        await conn.query(
          `DELETE FROM pedidos_detalle WHERE pd_id IN (${itemsEliminados.map(() => '?').join(',')})`,
          itemsEliminados
        );
      }
      
      // 3. Eliminar variantes borrador marcadas para eliminación
      if (variantesBorradorEliminadas.length > 0) {
        await conn.query(
          `DELETE FROM variantes_borrador WHERE vb_id IN (${variantesBorradorEliminadas.map(() => '?').join(',')})`,
          variantesBorradorEliminadas
        );
      }
      
      // 4. Eliminar productos borrador marcados para eliminación
      if (productosBorradorEliminados.length > 0) {
        await conn.query(
          `DELETE FROM pedidos_borrador_producto WHERE pbp_id IN (${productosBorradorEliminados.map(() => '?').join(',')})`,
          productosBorradorEliminados
        );
      }
      
      // 5. Actualizar ítems existentes
      if (modificaciones.items) {
        for (const [index, item] of Object.entries(modificaciones.items)) {
          const indexNum = parseInt(index);
          const itemId = pedidoAnterior.items?.[indexNum]?.pd_id;
          if (itemId && item.pd_cantidad_pedida !== undefined) {
            const cantidad = parseFloat(item.pd_cantidad_pedida) || 0;
            const precio = parseFloat(item.pd_precio_unitario) || 0;
            const subtotal = cantidad * precio;
            
            await conn.query(
              `UPDATE pedidos_detalle SET pd_cantidad_pedida = ?, pd_precio_unitario = ?, pd_subtotal = ? WHERE pd_id = ?`,
              [cantidad, precio, subtotal, itemId]
            );
          }
        }
      }
      
      // 6. Actualizar variantes borrador
      if (modificaciones.variantesBorrador) {
        for (const [index, variante] of Object.entries(modificaciones.variantesBorrador)) {
          const indexNum = parseInt(index);
          const varianteId = pedidoAnterior.variantesBorrador?.[indexNum]?.vb_id;
          if (varianteId && variante.vb_cantidad !== undefined) {
            const cantidad = parseFloat(variante.vb_cantidad) || 0;
            const precio = parseFloat(variante.vb_precio_unitario) || 0;
            
            await conn.query(
              `UPDATE variantes_borrador SET vb_cantidad = ?, vb_precio_unitario = ? WHERE vb_id = ?`,
              [cantidad, precio, varianteId]
            );
          }
        }
      }
      
      // 7. Actualizar productos borrador
      if (modificaciones.productosBorrador) {
        for (const [index, producto] of Object.entries(modificaciones.productosBorrador)) {
          const indexNum = parseInt(index);
          const productoId = pedidoAnterior.productosBorrador?.[indexNum]?.pbp_id;
          if (productoId && producto.pbp_cantidad !== undefined) {
            const cantidad = parseFloat(producto.pbp_cantidad) || 0;
            const precio = parseFloat(producto.pbp_precio_costo) || 0;
            
            await conn.query(
              `UPDATE pedidos_borrador_producto SET pbp_cantidad = ?, pbp_precio_unitario = ? WHERE pbp_id = ?`,
              [cantidad, precio, productoId]
            );
          }
        }
      }
      
      // 8. Recalcular total del pedido
      const [totalesResult] = await conn.query(`
        SELECT 
          (
            SELECT COALESCE(SUM(pd_subtotal), 0)
            FROM pedidos_detalle 
            WHERE pd_pedido_id = ?
          ) +
          (
            SELECT COALESCE(SUM(vb_cantidad * vb_precio_unitario), 0)
            FROM variantes_borrador 
            WHERE vb_pedido_id = ?
          ) +
          (
            SELECT COALESCE(SUM(pbp_cantidad * pbp_precio_unitario), 0)
            FROM pedidos_borrador_producto 
            WHERE pbp_pedido_id = ?
          ) as total_productos
      `, [pedido_id, pedido_id, pedido_id]);
      
      const totalProductos = totalesResult[0]?.total_productos || 0;
      const descuento = parseFloat(camposBasicos.pedido_descuento || pedidoExistente[0].pedido_descuento || 0);
      const costoEnvio = parseFloat(camposBasicos.pedido_costo_envio || pedidoExistente[0].pedido_costo_envio || 0);
  const totalFinal = totalProductos - (totalProductos * (descuento / 100)) + costoEnvio;
      
      // Agregar el total calculado a los campos básicos
      camposBasicos.pedido_total = totalFinal;
      
      // 9. Actualizar campos básicos del pedido (incluyendo el total)
      if (Object.keys(camposBasicos).length > 0) {
        const campos = Object.keys(camposBasicos).map(c => `${c} = ?`);
        const valores = Object.values(camposBasicos);
        
        await conn.query(
          `UPDATE pedidos SET ${campos.join(', ')} WHERE pedido_id = ?`, 
          [...valores, pedido_id]
        );
      }
      
      // 10. Obtener detalle nuevo para historial (usar conexión directa)
      const [cabeceraNueva] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      const [itemsNuevos] = await conn.query('SELECT * FROM pedidos_detalle WHERE pd_pedido_id = ?', [pedido_id]);
      const [variantesBorradorNuevas] = await conn.query('SELECT * FROM variantes_borrador WHERE vb_pedido_id = ?', [pedido_id]);
      const [productosBorradorNuevos] = await conn.query('SELECT * FROM pedidos_borrador_producto WHERE pbp_pedido_id = ?', [pedido_id]);
      
      const pedidoNuevo = {
        ...cabeceraNueva[0],
        items: itemsNuevos,
        variantesBorrador: variantesBorradorNuevas,
        productosBorrador: productosBorradorNuevos
      };
      
      // 11. Registrar modificación en historial
      await conn.query(
        `INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)`,
        [
          pedido_id,
          usuario_id,
          motivo,
          JSON.stringify(pedidoAnterior),
          JSON.stringify(pedidoNuevo)
        ]
      );
      
      await conn.commit();
      return { success: true, message: 'Pedido modificado exitosamente', total: totalFinal };
    } catch (err) {
      await conn.rollback();
      console.error('Error al modificar pedido completo:', err);
      throw err;
    } finally {
      conn.release();
    }
  }
}

export default new PedidoService();
