import { pool } from '../db.js';

/**
 * Obtiene lista de todas las ventas con información básica
 */
export const obtenerVentas = async (req, res) => {
  try {
    const [ventas] = await pool.query(`
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
    `);
    
    res.status(200).json(ventas);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ message: 'Error interno al obtener ventas.' });
  }
};

/**
 * Obtiene detalles completos de una venta por su ID
 */
export const obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;
  
  try {
    const conn = await pool.getConnection();
    
    // 1. Obtener datos principales de la venta
    const [venta] = await conn.query(`
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
    `, [id]);
    
    if (venta.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
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
      const [invitado] = await conn.query(`
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
      `, [id]);
      
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
    const [productos] = await conn.query(`
      SELECT 
        vd.detalle_id,
        vd.detalle_cantidad,
        vd.detalle_precio_unitario,
        p.producto_id,
        p.producto_nombre,
        vd.vd_variante_id,
        v.variante_sku,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS variante_descripcion,
        ip.imagen_url
      FROM ventas_detalle vd
      JOIN productos p ON vd.producto_id = p.producto_id
      LEFT JOIN variantes v ON vd.vd_variante_id = v.variante_id
      LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
      LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
      LEFT JOIN imagenes_productos ip ON (
        CASE 
          WHEN v.imagen_id IS NOT NULL THEN ip.imagen_id = v.imagen_id
          ELSE ip.producto_id = p.producto_id AND ip.imagen_orden = 0
        END
      )
      WHERE vd.venta_id = ?
      GROUP BY vd.detalle_id, p.producto_nombre, v.variante_sku, ip.imagen_url
    `, [id]);
    
    resultado.productos = productos;
    
    // 4. Si hay cupón, obtener sus datos
    if (resultado.cupon_id) {
      const [cupon] = await conn.query(`
        SELECT 
          cupon_codigo,
          cupon_porcentaje,
          cupon_monto_fijo
        FROM cupones
        WHERE cupon_id = ?
      `, [resultado.cupon_id]);
      
      if (cupon.length > 0) {
        resultado.cupon = cupon[0];
      }
    }
    
    conn.release();
    res.status(200).json(resultado);
    
  } catch (error) {
    console.error('Error al obtener venta por ID:', error);
    res.status(500).json({ message: 'Error interno al obtener detalles de la venta.' });
  }
};

/**
 * Crea una nueva venta
 */
export const crearVenta = async (req, res) => {
  const {
    venta,
    productos,
    cliente_invitado,
    envio
  } = req.body;
  
  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ message: 'Debe incluir al menos un producto en la venta.' });
  }

  // Si no hay cliente_id pero tampoco hay datos del cliente invitado, es un error
  if (!venta.cliente_id && (!cliente_invitado || !cliente_invitado.nombre || !cliente_invitado.apellido)) {
    return res.status(400).json({ message: 'Debe proporcionar un cliente registrado o datos de cliente invitado.' });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Crear la venta principal
    const [resultadoVenta] = await conn.query(
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
        venta.cliente_id || null,
        venta.cupon_id || null,
        venta.venta_estado_pago || 'pendiente',
        venta.venta_estado_envio || 'pendiente',
        venta.venta_monto_total,
        venta.venta_monto_descuento || 0,
        venta.venta_origen || 'Venta Manual',
        venta.venta_nota || null
      ]
    );
    
    const ventaId = resultadoVenta.insertId;
    
    // 2. Insertar productos en ventas_detalle
    for (const producto of productos) {
      await conn.query(
        `INSERT INTO ventas_detalle (
          venta_id,
          producto_id,
          vd_variante_id,
          detalle_cantidad,
          detalle_precio_unitario
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          ventaId,
          producto.producto_id,
          producto.variante_id || null,
          producto.cantidad,
          producto.precio_unitario
        ]
      );
      
      // 3. Actualizar stock si el pago está abonado
      if (venta.venta_estado_pago === 'abonado') {
        if (producto.variante_id) {
          // Actualizar stock de variante
          await conn.query(
            `UPDATE stock SET cantidad = cantidad - ? WHERE variante_id = ?`,
            [producto.cantidad, producto.variante_id]
          );
        } else {
          // Actualizar stock de producto
          await conn.query(
            `UPDATE stock SET cantidad = cantidad - ? WHERE producto_id = ? AND variante_id IS NULL`,
            [producto.cantidad, producto.producto_id]
          );
        }
      }
    }
    
    // 4. Si es cliente invitado y hay envío, guardar datos de envío
    if (!venta.cliente_id && envio && cliente_invitado) {
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
          cliente_invitado.nombre,
          cliente_invitado.apellido,
          cliente_invitado.email,
          cliente_invitado.telefono || null,
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
    
    res.status(201).json({
      message: 'Venta creada exitosamente',
      venta_id: ventaId
    });
    
  } catch (error) {
    await conn.rollback();
    console.error('Error al crear venta:', error);
    res.status(500).json({ message: 'Error interno al crear la venta.' });
  } finally {
    conn.release();
  }
};

/**
 * Cambia el estado de pago de una venta
 */
export const actualizarEstadoPago = async (req, res) => {
  const { id } = req.params;
  const { estado_pago } = req.body;
  
  if (!estado_pago || !['pendiente', 'abonado', 'cancelado'].includes(estado_pago)) {
    return res.status(400).json({ message: 'Estado de pago inválido.' });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Primero obtenemos el estado actual
    const [ventaActual] = await conn.query(
      `SELECT venta_estado_pago FROM ventas WHERE venta_id = ?`,
      [id]
    );
    
    if (ventaActual.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }
    
    const estadoActual = ventaActual[0].venta_estado_pago;
    
    // Actualizar estado de pago
    await conn.query(
      `UPDATE ventas SET venta_estado_pago = ? WHERE venta_id = ?`,
      [estado_pago, id]
    );
    
    // Si cambia de pendiente a abonado, actualizar stock
    if (estadoActual === 'pendiente' && estado_pago === 'abonado') {
      const [productos] = await conn.query(
        `SELECT 
          producto_id, 
          vd_variante_id, 
          detalle_cantidad 
        FROM ventas_detalle 
        WHERE venta_id = ?`,
        [id]
      );
      
      for (const producto of productos) {
        if (producto.vd_variante_id) {
          // Actualizar stock de variante
          await conn.query(
            `UPDATE stock SET cantidad = cantidad - ? WHERE variante_id = ?`,
            [producto.detalle_cantidad, producto.vd_variante_id]
          );
        } else {
          // Actualizar stock de producto
          await conn.query(
            `UPDATE stock SET cantidad = cantidad - ? WHERE producto_id = ? AND variante_id IS NULL`,
            [producto.detalle_cantidad, producto.producto_id]
          );
        }
      }
    }
    
    // Si cambia de abonado a pendiente o cancelado, restaurar stock
    if (estadoActual === 'abonado' && (estado_pago === 'pendiente' || estado_pago === 'cancelado')) {
      const [productos] = await conn.query(
        `SELECT 
          producto_id, 
          vd_variante_id, 
          detalle_cantidad 
        FROM ventas_detalle 
        WHERE venta_id = ?`,
        [id]
      );
      
      for (const producto of productos) {
        if (producto.vd_variante_id) {
          // Restaurar stock de variante
          await conn.query(
            `UPDATE stock SET cantidad = cantidad + ? WHERE variante_id = ?`,
            [producto.detalle_cantidad, producto.vd_variante_id]
          );
        } else {
          // Restaurar stock de producto
          await conn.query(
            `UPDATE stock SET cantidad = cantidad + ? WHERE producto_id = ? AND variante_id IS NULL`,
            [producto.detalle_cantidad, producto.producto_id]
          );
        }
      }
    }
    
    await conn.commit();
    
    res.status(200).json({
      message: 'Estado de pago actualizado correctamente',
      estado_pago
    });
    
  } catch (error) {
    await conn.rollback();
    console.error('Error al actualizar estado de pago:', error);
    res.status(500).json({ message: 'Error interno al actualizar el estado de pago.' });
  } finally {
    conn.release();
  }
};

/**
 * Cambia el estado de envío de una venta
 */
export const actualizarEstadoEnvio = async (req, res) => {
  const { id } = req.params;
  const { estado_envio } = req.body;
  
  if (!estado_envio || !['pendiente', 'enviado', 'entregado', 'cancelado'].includes(estado_envio)) {
    return res.status(400).json({ message: 'Estado de envío inválido.' });
  }
  
  try {
    const [result] = await pool.query(
      `UPDATE ventas SET venta_estado_envio = ? WHERE venta_id = ?`,
      [estado_envio, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }
    
    res.status(200).json({
      message: 'Estado de envío actualizado correctamente',
      estado_envio
    });
    
  } catch (error) {
    console.error('Error al actualizar estado de envío:', error);
    res.status(500).json({ message: 'Error interno al actualizar el estado de envío.' });
  }
};

/**
 * Busca productos disponibles para agregar a una venta
 */
export const buscarProductosParaVenta = async (req, res) => {
  const { termino } = req.query;
  
  try {
    // Si no hay término de búsqueda, devolver productos destacados o recientes
    if (!termino) {
      const [productos] = await pool.query(`
        SELECT 
          p.producto_id,
          p.producto_nombre,
          p.producto_precio_venta,
          p.producto_precio_oferta,
          COALESCE(s.cantidad, 0) AS stock,
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
      `);
      
      return res.status(200).json(productos);
    }
    
    // Búsqueda por término
    const [productos] = await pool.query(`
      SELECT 
        p.producto_id,
        p.producto_nombre,
        p.producto_precio_venta,
        p.producto_precio_oferta,
        COALESCE(s.cantidad, 0) AS stock,
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
    `, [`%${termino}%`, `%${termino}%`, `${termino}%`]);
    
    res.status(200).json(productos);
    
  } catch (error) {
    console.error('Error al buscar productos para venta:', error);
    res.status(500).json({ message: 'Error interno al buscar productos.' });
  }
};

/**
 * Obtiene las variantes de un producto para selección en la venta
 */
export const obtenerVariantesProducto = async (req, res) => {
  const { producto_id } = req.params;
  
  try {
    const [variantes] = await pool.query(`
      SELECT 
        v.variante_id,
        v.variante_precio_venta,
        v.variante_precio_oferta,
        v.variante_sku,
        COALESCE(s.cantidad, 0) AS stock,
        ip.imagen_url,
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS descripcion,
        JSON_OBJECTAGG(a.atributo_nombre, vv.valor_nombre) AS atributos
      FROM variantes v
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.producto_id = ? AND v.variante_estado = 'activo'
      GROUP BY v.variante_id, v.variante_precio_venta, v.variante_precio_oferta, v.variante_sku, s.cantidad, ip.imagen_url
    `, [producto_id]);
    
    res.status(200).json(variantes);
    
  } catch (error) {
    console.error('Error al obtener variantes de producto:', error);
    res.status(500).json({ message: 'Error interno al obtener variantes del producto.' });
  }
};

/**
 * Verifica el stock disponible antes de confirmar una venta
 */
export const verificarStock = async (req, res) => {
  const { productos } = req.body;
  
  if (!productos || !Array.isArray(productos)) {
    return res.status(400).json({ message: 'Formato de datos inválido.' });
  }
  
  try {
    const resultados = [];
    let todosDisponibles = true;
    
    for (const producto of productos) {
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
      
      resultados.push({
        producto_id: producto.producto_id,
        variante_id: producto.variante_id || null,
        cantidad_solicitada: producto.cantidad,
        stock_disponible: stock,
        disponible
      });
      
      if (!disponible) {
        todosDisponibles = false;
      }
    }
    
    res.status(200).json({
      todosDisponibles,
      resultados
    });
    
  } catch (error) {
    console.error('Error al verificar stock:', error);
    res.status(500).json({ message: 'Error interno al verificar stock.' });
  }
};