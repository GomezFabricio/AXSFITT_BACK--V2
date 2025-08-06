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
    CREAR_DETALLE_SIN_REGISTRAR: `INSERT INTO pedidos_detalle (pd_pedido_id, pd_producto_sin_registrar, pd_cantidad_pedida, pd_precio_unitario) VALUES (?, ?, ?, ?)`,
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

    // 6. Subtotal calculado (solo ítems registrados y borrador)
    const subtotal = [...items, ...variantesBorrador, ...productosBorrador].reduce((acc, item) => {
      const cantidad = item.pd_cantidad_pedida || item.vb_cantidad || item.pbp_cantidad || 0;
      const precio = item.pd_precio_unitario || item.vb_precio_unitario || item.pbp_precio_unitario || 0;
      const subtotalItem = item.pd_subtotal || (precio * cantidad);
      return acc + Number(subtotalItem || 0);
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
   * Crea un nuevo pedido y sus detalles
   * @param {Object} data - { proveedor_id, productos: [{producto_id, cantidad, precio_costo}], productosSinRegistrar: [{nombre, cantidad, precio_costo}] }
   */
  async crearPedido(data) {
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
      // Guardar variantes en borrador
      for (const vb of variantesBorrador) {
        await conn.query(
          'INSERT INTO variantes_borrador (vb_pedido_id, vb_producto_id, vb_atributos, vb_cantidad, vb_precio_unitario, vb_estado) VALUES (?, ?, ?, ?, ?, ?)',
          [pedido_id, vb.vb_producto_id, JSON.stringify(vb.vb_atributos), vb.vb_cantidad, vb.vb_precio_unitario, 'borrador']
        );
      }
      // Guardar productos en borrador
      for (const pb of productosBorrador) {
        await conn.query(
          'INSERT INTO pedidos_borrador_producto (pbp_pedido_id, pbp_nombre, pbp_cantidad, pbp_precio_unitario, pbp_estado) VALUES (?, ?, ?, ?, ?)',
          [pedido_id, pb.pbp_nombre, pb.pbp_cantidad, pb.pbp_precio_unitario, 'borrador']
        );
      }
      const fechaPedido = new Date();
      // Calcular total si no viene
      let pedido_total = total;
      if (pedido_total === null) {
        pedido_total = productos.reduce((acc, p) => acc + ((Number(p.precio_costo) || 0) * (Number(p.cantidad) || 1)), 0);
        pedido_total = Math.max(0, pedido_total - (Number(descuento) || 0)) + (Number(costo_envio) || 0);
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
      // Detalles productos sin registrar
      for (const prod of productosSinRegistrar) {
        await conn.query(PedidoService.QUERIES.CREAR_DETALLE_SIN_REGISTRAR, [pedido_id, prod.nombre, prod.cantidad, prod.precio_costo]);
      }
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
   * @param {number} pedido_id
   * @param {Array} recepcion - [{detalle_id, cantidad_recibida, precio_costo_nuevo}]
   * @param {number} usuario_id
   */
  async recepcionarPedido(pedido_id, recepcion, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Actualizar estado pedido
      await conn.query(PedidoService.QUERIES.RECEPCIONAR_PEDIDO, [new Date(), pedido_id]);
      // Actualizar detalles y stock
      for (const item of recepcion) {
        // Actualizar detalle
        await conn.query('UPDATE pedidos_detalle SET cantidad_recibida = ?, precio_costo_recibido = ? WHERE detalle_id = ?', [item.cantidad_recibida, item.precio_costo_nuevo, item.detalle_id]);
        // Actualizar stock y movimientos
        await conn.query('UPDATE stock SET cantidad = cantidad + ? WHERE producto_id = ?', [item.cantidad_recibida, item.producto_id]);
        await conn.query('INSERT INTO stock_movimientos (producto_id, cantidad, tipo, fecha, referencia) VALUES (?, ?, ?, ?, ?)', [item.producto_id, item.cantidad_recibida, 'ingreso', new Date(), `Pedido ${pedido_id}`]);
        // Registrar precio histórico si cambió
        if (item.precio_costo_nuevo) {
          await conn.query('INSERT INTO precios_historicos (producto_id, precio, fecha, referencia) VALUES (?, ?, ?, ?)', [item.producto_id, item.precio_costo_nuevo, new Date(), `Pedido ${pedido_id}`]);
        }
      }

      // 1. Migrar variantes en borrador a tablas oficiales
      const [variantesBorrador] = await conn.query('SELECT * FROM variantes_borrador WHERE vb_pedido_id = ?', [pedido_id]);
      for (const vb of variantesBorrador) {
        // 1.1. Si el producto ya tiene atributos, usar los existentes. Si no, crear los atributos.
        let atributoIds = {};
        if (vb.vb_atributos && Array.isArray(vb.vb_atributos)) {
          for (const attr of vb.vb_atributos) {
            // Buscar o crear atributo
            let [rows] = await conn.query('SELECT atributo_id FROM atributos WHERE atributo_nombre = ? AND producto_id = ?', [attr.nombre, vb.vb_producto_id]);
            let atributo_id;
            if (rows.length > 0) {
              atributo_id = rows[0].atributo_id;
            } else {
              let res = await conn.query('INSERT INTO atributos (producto_id, atributo_nombre) VALUES (?, ?)', [vb.vb_producto_id, attr.nombre]);
              atributo_id = res[0].insertId;
            }
            atributoIds[attr.nombre] = atributo_id;
          }
        }
        // 1.2. Crear variante inactiva
        let resVar = await conn.query('INSERT INTO variantes (producto_id, variante_estado, variante_precio_costo) VALUES (?, ?, ?)', [vb.vb_producto_id, 'inactivo', vb.vb_precio_unitario]);
        let variante_id = resVar[0].insertId;
        // 1.3. Crear valores de variante
        if (vb.vb_atributos && Array.isArray(vb.vb_atributos)) {
          for (const attr of vb.vb_atributos) {
            let atributo_id = atributoIds[attr.nombre];
            // Buscar o crear valor
            let [valRows] = await conn.query('SELECT valor_id FROM valores_variantes WHERE atributo_id = ? AND valor_nombre = ?', [atributo_id, attr.valor]);
            let valor_id;
            if (valRows.length > 0) {
              valor_id = valRows[0].valor_id;
            } else {
              let res = await conn.query('INSERT INTO valores_variantes (atributo_id, valor_nombre) VALUES (?, ?)', [atributo_id, attr.valor]);
              valor_id = res[0].insertId;
            }
            // Asociar valor a variante
            await conn.query('INSERT INTO variante_valor (variante_id, valor_id) VALUES (?, ?)', [variante_id, valor_id]);
          }
        }
      }
      // Eliminar variantes borrador migradas
      await conn.query('DELETE FROM variantes_borrador WHERE vb_pedido_id = ?', [pedido_id]);

      // 2. Migrar productos borrador a tabla oficial de productos (inactivos)
      const [productosBorrador] = await conn.query('SELECT * FROM pedidos_borrador_producto WHERE pbp_pedido_id = ?', [pedido_id]);
      for (const pb of productosBorrador) {
        // Crear producto inactivo
        let resProd = await conn.query('INSERT INTO productos (producto_nombre, producto_estado) VALUES (?, ?)', [pb.pbp_nombre, 'inactivo']);
        let producto_id = resProd[0].insertId;
        // Si tiene variantes asociadas, migrarlas (no implementado aquí, requiere lógica adicional si se usan variantes en productos borrador)
      }
      // Eliminar productos borrador migrados
      await conn.query('DELETE FROM pedidos_borrador_producto WHERE pbp_pedido_id = ?', [pedido_id]);

      // Registrar modificación
      await conn.query(PedidoService.QUERIES.CREAR_MODIFICACION, [pedido_id, usuario_id, 'Recepción de pedido', new Date()]);
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
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
  async modificarPedido(pedido_id, modificaciones, usuario_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Obtener detalle anterior
      const [pedidoAnt] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      // Actualizar pedido
      const campos = Object.keys(modificaciones).map(c => `${c} = ?`).join(', ');
      const valores = Object.values(modificaciones);
      await conn.query(`UPDATE pedidos SET ${campos} WHERE pedido_id = ?`, [...valores, pedido_id]);
      // Obtener detalle nuevo
      const [pedidoNuevo] = await conn.query('SELECT * FROM pedidos WHERE pedido_id = ?', [pedido_id]);
      // Registrar modificación
      await conn.query(
        `INSERT INTO pedidos_modificaciones (pm_pedido_id, pm_usuario_id, pm_motivo, pm_detalle_anterior, pm_detalle_nuevo) VALUES (?, ?, ?, ?, ?)`,
        [
          pedido_id,
          usuario_id,
          'Modificación de pedido',
          JSON.stringify(pedidoAnt[0] || {}),
          JSON.stringify(pedidoNuevo[0] || {})
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
}

export default new PedidoService();
