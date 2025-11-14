import { ApiResponse } from '../utils/apiResponse.js';
import { pool } from '../db.js';

/**
 * Controlador para gestión de Carrito de Pedido Rápido
 * Integrado completamente con la estructura de BD axsfitt
 * Respeta la lógica de faltantes, pedidos y stock existente
 */

// Variable temporal para simular sesiones de carrito (en producción usar Redis)
const carritosSesiones = new Map();

/**
 * GET /api/carrito-pedidos/carrito
 * Obtener carrito actual del usuario
 */
export const obtenerCarrito = async (req, res) => {
  try {
    console.log('📄 [CARRITO] Obteniendo carrito para usuario:', req.user.usuario_id);
    
    const usuario_id = req.user.usuario_id;
    const carritoUsuario = carritosSesiones.get(usuario_id) || { 
      items: [], 
      proveedor_id: null 
    };
    
    console.log('✅ [CARRITO] Carrito obtenido:', carritoUsuario);
    return ApiResponse.success(res, carritoUsuario, 'Carrito obtenido exitosamente');
  } catch (error) {
    console.error('❌ [CARRITO] Error al obtener carrito:', error);
    return ApiResponse.error(res, 'Error al obtener el carrito', 500);
  }
};

/**
 * POST /api/carrito-pedidos/carrito/agregar
 * Agregar faltante al carrito
 */
export const agregarAlCarrito = async (req, res) => {
  try {
    console.log('➕ [CARRITO] Agregando item al carrito:', req.body);
    
    const usuario_id = req.user.usuario_id;
    const { faltante_id, variante_id, cantidad } = req.body;

    // Validaciones básicas
    if (!faltante_id || !variante_id) {
      return ApiResponse.error(res, 'Se requiere faltante_id y variante_id', 400);
    }

    // 1️⃣ Validar que el faltante exista y no esté resuelto
    const [faltantes] = await pool.query(`
      SELECT 
        f.faltante_id,
        f.faltante_variante_id,
        f.faltante_cantidad_faltante,
        f.faltante_estado,
        f.faltante_fecha_deteccion
      FROM faltantes f
      WHERE f.faltante_id = ? 
        AND f.faltante_variante_id = ?
        AND f.faltante_estado IN ('detectado', 'registrado')
    `, [faltante_id, variante_id]);

    if (faltantes.length === 0) {
      return ApiResponse.error(res, 'Faltante no encontrado o ya está resuelto', 404);
    }

    const faltante = faltantes[0];

    // 2️⃣ Validar que la variante exista
    const [variantes] = await pool.query(`
      SELECT 
        v.variante_id,
        v.variante_sku,
        v.variante_precio_venta,
        p.producto_id,
        p.producto_nombre,
        s.cantidad AS stock_actual,
        s.stock_minimo,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos
      FROM variantes v
      INNER JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE v.variante_id = ?
      GROUP BY v.variante_id
    `, [variante_id]);

    if (variantes.length === 0) {
      return ApiResponse.error(res, 'Variante no encontrada', 404);
    }

    const variante = variantes[0];

    // 3️⃣ Validar cantidad (por defecto usar la cantidad faltante)
    const cantidadFinal = cantidad || faltante.faltante_cantidad_faltante;

    if (cantidadFinal > faltante.faltante_cantidad_faltante) {
      return ApiResponse.error(res, 'La cantidad no puede ser mayor a la cantidad faltante', 400);
    }

    // 4️⃣ Obtener carrito actual y evitar duplicados
    const carrito = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    const itemKey = `${faltante_id}-${variante_id}`;
    
    // Verificar si ya existe
    const itemExistente = carrito.items.find(item => item.item_key === itemKey);
    if (itemExistente) {
      return ApiResponse.error(res, 'Este faltante ya está en el carrito', 400);
    }

    // 5️⃣ Crear item del carrito
    const nuevoItem = {
      item_key: itemKey,
      faltante_id: faltante.faltante_id,
      variante_id: variante.variante_id,
      producto_id: variante.producto_id,
      producto_nombre: variante.producto_nombre,
      variante_sku: variante.variante_sku,
      atributos: variante.atributos,
      cantidad_faltante: faltante.faltante_cantidad_faltante,
      cantidad: cantidadFinal, // Frontend espera 'cantidad'
      precio: variante.variante_precio_venta || 0, // Frontend espera 'precio'
      precio_unitario: variante.variante_precio_venta || 0, // Mantener también para compatibilidad
      subtotal: (variante.variante_precio_venta || 0) * cantidadFinal,
      stock_actual: variante.stock_actual || 0,
      fecha_agregado: new Date()
    };

    carrito.items.push(nuevoItem);
    carritosSesiones.set(usuario_id, carrito);

    console.log('✅ [CARRITO] Item agregado exitosamente:', nuevoItem);
    return ApiResponse.success(res, carrito, 'Producto agregado al carrito exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al agregar al carrito:', error.message);
    console.error('❌ [CARRITO] Stack trace:', error.stack);
    return ApiResponse.error(res, 'Error al agregar producto al carrito', 500);
  }
};

/**
 * DELETE /api/carrito-pedidos/carrito/quitar
 * Quitar item del carrito
 */
export const quitarDelCarrito = async (req, res) => {
  try {
    console.log('➖ [CARRITO] Quitando item del carrito:', req.body);
    
    const usuario_id = req.user.usuario_id;
    const { item_key } = req.body;

    if (!item_key) {
      return ApiResponse.error(res, 'Se requiere item_key', 400);
    }

    const carrito = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    const indexItem = carrito.items.findIndex(item => item.item_key === item_key);

    if (indexItem === -1) {
      return ApiResponse.error(res, 'Item no encontrado en el carrito', 404);
    }

    carrito.items.splice(indexItem, 1);
    carritosSesiones.set(usuario_id, carrito);

    console.log('✅ [CARRITO] Item quitado exitosamente:', item_key);
    return ApiResponse.success(res, carrito, 'Producto quitado del carrito exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al quitar del carrito:', error);
    return ApiResponse.error(res, 'Error al quitar producto del carrito', 500);
  }
};

/**
 * PUT /api/carrito-pedidos/carrito/cantidad
 * Actualizar cantidad de un item en el carrito
 */
export const actualizarCantidadCarrito = async (req, res) => {
  try {
    console.log('🔄 [CARRITO] Actualizando cantidad:', req.body);
    
    const usuario_id = req.user.usuario_id;
    const { item_key, cantidad } = req.body;

    console.log('🔍 [DEBUG] item_key:', item_key, 'cantidad:', cantidad, 'tipo:', typeof cantidad);

    if (!item_key || cantidad === null || cantidad === undefined || cantidad <= 0) {
      return ApiResponse.error(res, 'Se requiere item_key y cantidad válida', 400);
    }

    const carrito = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    const item = carrito.items.find(item => item.item_key === item_key);

    if (!item) {
      return ApiResponse.error(res, 'Item no encontrado en el carrito', 404);
    }

    if (cantidad > item.cantidad_faltante) {
      return ApiResponse.error(res, 'La cantidad no puede ser mayor a la cantidad faltante', 400);
    }

    item.cantidad = cantidad; // Usar 'cantidad' que espera el frontend
    item.subtotal = item.precio * cantidad; // Usar 'precio' que espera el frontend

    carritosSesiones.set(usuario_id, carrito);

    console.log('✅ [CARRITO] Cantidad actualizada:', item);
    return ApiResponse.success(res, carrito, 'Cantidad actualizada exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al actualizar cantidad:', error);
    return ApiResponse.error(res, 'Error al actualizar cantidad', 500);
  }
};

/**
 * GET /api/carrito-pedidos/proveedores
 * Obtener lista de proveedores activos
 */
export const obtenerProveedores = async (req, res) => {
  try {
    console.log('🏢 [CARRITO] Obteniendo proveedores activos');
    
    const [proveedores] = await pool.query(`
      SELECT 
        proveedor_id,
        proveedor_nombre,
        proveedor_contacto,
        proveedor_email,
        proveedor_telefono
      FROM proveedores 
      WHERE proveedor_estado = 'activo'
      ORDER BY proveedor_nombre
    `);

    console.log('✅ [CARRITO] Proveedores obtenidos:', proveedores.length);
    return ApiResponse.success(res, proveedores, 'Proveedores obtenidos exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al obtener proveedores:', error);
    return ApiResponse.error(res, 'Error al obtener proveedores', 500);
  }
};

/**
 * POST /api/carrito-pedidos/carrito/proveedor
 * Seleccionar proveedor para el carrito
 */
export const seleccionarProveedor = async (req, res) => {
  try {
    console.log('🏢 [CARRITO] Seleccionando proveedor:', req.body);
    
    const usuario_id = req.user.usuario_id;
    const { proveedor_id } = req.body;

    if (!proveedor_id) {
      return ApiResponse.error(res, 'Se requiere proveedor_id', 400);
    }

    // Validar que el proveedor existe y está activo
    const [proveedores] = await pool.query(`
      SELECT proveedor_id, proveedor_nombre 
      FROM proveedores 
      WHERE proveedor_id = ? AND proveedor_estado = 'activo'
    `, [proveedor_id]);

    if (proveedores.length === 0) {
      return ApiResponse.error(res, 'Proveedor no encontrado o inactivo', 404);
    }

    const carrito = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    carrito.proveedor_id = proveedor_id;
    carritosSesiones.set(usuario_id, carrito);

    console.log('✅ [CARRITO] Proveedor seleccionado:', proveedor_id);
    return ApiResponse.success(res, carrito, 'Proveedor seleccionado exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al seleccionar proveedor:', error);
    return ApiResponse.error(res, 'Error al seleccionar proveedor', 500);
  }
};

/**
 * DELETE /api/carrito-pedidos/carrito/vaciar
 * Vaciar completamente el carrito
 */
export const vaciarCarrito = async (req, res) => {
  try {
    console.log('🗑️ [CARRITO] Vaciando carrito para usuario:', req.user.usuario_id);
    
    const usuario_id = req.user.usuario_id;
    const carritoVacio = { items: [], proveedor_id: null };
    
    carritosSesiones.set(usuario_id, carritoVacio);

    console.log('✅ [CARRITO] Carrito vaciado exitosamente');
    return ApiResponse.success(res, carritoVacio, 'Carrito vaciado exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al vaciar carrito:', error);
    return ApiResponse.error(res, 'Error al vaciar carrito', 500);
  }
};

/**
 * POST /api/carrito-pedidos/carrito/confirmar
 * Confirmar pedido: Crear pedido en BD y actualizar faltantes
 */
export const confirmarPedido = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('🎯 [CARRITO] Confirmando pedido para usuario:', req.user.usuario_id);
    
    await connection.beginTransaction();
    
    const usuario_id = req.user.usuario_id;
    const carrito = carritosSesiones.get(usuario_id);

    // Validaciones
    if (!carrito || carrito.items.length === 0) {
      return ApiResponse.error(res, 'El carrito está vacío', 400);
    }

    if (!carrito.proveedor_id) {
      return ApiResponse.error(res, 'Debe seleccionar un proveedor', 400);
    }

    // 1️⃣ Crear registro de pedido principal
    const pedidoFecha = new Date();
    const [pedidoResult] = await connection.query(`
      INSERT INTO pedidos (
        pedido_proveedor_id,
        pedido_usuario_id,
        pedido_fecha,
        pedido_estado,
        pedido_total,
        pedido_observaciones
      ) VALUES (?, ?, ?, 'pendiente', 0, 'Pedido generado desde Carrito de Pedido Rápido')
    `, [carrito.proveedor_id, usuario_id, pedidoFecha]);

    const pedido_id = pedidoResult.insertId;
    console.log('📝 [CARRITO] Pedido creado con ID:', pedido_id);

    let totalPedido = 0;

    // 2️⃣ Procesar cada item del carrito
    for (const item of carrito.items) {
      // Crear detalle del pedido
      const [detalleResult] = await connection.query(`
        INSERT INTO pedidos_detalle (
          detalle_pedido_id,
          detalle_variante_id,
          detalle_cantidad,
          detalle_precio_unitario,
          detalle_subtotal
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        pedido_id,
        item.variante_id,
        item.cantidad_pedida,
        item.precio_unitario,
        item.subtotal
      ]);

      totalPedido += item.subtotal;

      // 3️⃣ Actualizar estado del faltante a 'pedido_realizado'
      await connection.query(`
        UPDATE faltantes 
        SET 
          faltante_estado = 'pedido_realizado',
          faltante_pedido_id = ?,
          faltante_fecha_resolucion = NOW()
        WHERE faltante_id = ? AND faltante_variante_id = ?
      `, [pedido_id, item.faltante_id, item.variante_id]);

      // 4️⃣ Crear notificación de pedido realizado
      await connection.query(`
        INSERT INTO notificaciones_pendientes (
          notificacion_tipo,
          notificacion_titulo,
          notificacion_mensaje,
          notificacion_datos,
          notificacion_usuario_objetivo,
          notificacion_fecha_creacion,
          notificacion_estado,
          notificacion_prioridad
        ) VALUES (
          'pedido_realizado',
          'Pedido Realizado',
          ?,
          ?,
          ?,
          NOW(),
          'pendiente',
          'media'
        )
      `, [
        `Se ha creado el pedido #${pedido_id} para resolver el faltante de ${item.producto_nombre} (${item.cantidad_pedida} unidades)`,
        JSON.stringify({
          pedido_id: pedido_id,
          faltante_id: item.faltante_id,
          producto_nombre: item.producto_nombre,
          cantidad: item.cantidad_pedida,
          proveedor_id: carrito.proveedor_id
        }),
        usuario_id
      ]);

      console.log(`✅ [CARRITO] Procesado item: ${item.producto_nombre} x${item.cantidad_pedida}`);
    }

    // 5️⃣ Actualizar total del pedido
    await connection.query(`
      UPDATE pedidos 
      SET pedido_total = ? 
      WHERE pedido_id = ?
    `, [totalPedido, pedido_id]);

    await connection.commit();

    // 6️⃣ Limpiar carrito después de confirmar
    carritosSesiones.delete(usuario_id);

    const pedidoFinal = {
      pedido_id: pedido_id,
      pedido_fecha: pedidoFecha,
      pedido_estado: 'pendiente',
      pedido_total: totalPedido,
      proveedor_id: carrito.proveedor_id,
      items_procesados: carrito.items.length,
      faltantes_resueltos: carrito.items.map(item => item.faltante_id)
    };

    console.log('🎉 [CARRITO] Pedido confirmado exitosamente:', pedidoFinal);
    return ApiResponse.success(res, pedidoFinal, 'Pedido confirmado y procesado exitosamente');

  } catch (error) {
    await connection.rollback();
    console.error('❌ [CARRITO] Error al confirmar pedido:', error);
    return ApiResponse.error(res, 'Error al confirmar el pedido: ' + error.message, 500);
  } finally {
    connection.release();
  }
};

/**
 * GET /api/carrito-pedidos/faltantes
 * Obtener faltantes disponibles para agregar al carrito
 */
export const obtenerFaltantesDisponibles = async (req, res) => {
  try {
    console.log('🔍 [CARRITO] Obteniendo faltantes disponibles');
    
    const [faltantes] = await pool.query(`
      SELECT 
        f.faltante_id,
        f.faltante_variante_id,
        f.faltante_cantidad_faltante,
        f.faltante_estado,
        f.faltante_fecha_deteccion,
        v.variante_sku,
        v.variante_precio_venta,
        p.producto_nombre,
        s.cantidad AS stock_actual,
        s.stock_minimo,
        GROUP_CONCAT(DISTINCT CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos
      FROM faltantes f
      INNER JOIN variantes v ON f.faltante_variante_id = v.variante_id
      INNER JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN stock s ON s.variante_id = v.variante_id
      LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
      LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
      WHERE f.faltante_estado IN ('detectado', 'registrado')
      GROUP BY f.faltante_id, f.faltante_variante_id
      ORDER BY f.faltante_fecha_deteccion DESC
    `);

    console.log('✅ [CARRITO] Faltantes disponibles obtenidos:', faltantes.length);
    return ApiResponse.success(res, faltantes, 'Faltantes disponibles obtenidos exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al obtener faltantes:', error.message);
    console.error('❌ [CARRITO] Stack trace:', error.stack);
    return ApiResponse.error(res, 'Error al obtener faltantes disponibles', 500);
  }
};

/**
 * GET /api/carrito-pedidos/test
 * Endpoint de prueba para verificar conectividad
 */
export const probarConexion = async (req, res) => {
  try {
    console.log('🔍 [DIAGNÓSTICO] Prueba de conexión solicitada');
    
    // Verificar conexión a la base de datos
    const [result] = await pool.query('SELECT 1 as test');
    
    const diagnostico = {
      servidor: 'OK',
      baseDatos: 'OK',
      usuario: req.user ? req.user.usuario_id : 'No autenticado',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    console.log('✅ [DIAGNÓSTICO] Conexión exitosa:', diagnostico);
    return ApiResponse.success(res, diagnostico, 'Conexión exitosa');

  } catch (error) {
    console.error('❌ [DIAGNÓSTICO] Error en prueba de conexión:', error);
    return ApiResponse.error(res, 'Error en la prueba de conexión', 500);
  }
};

/**
 * GET /api/carrito-pedidos/carrito/info
 * Obtener información detallada del carrito con diagnósticos
 */
export const obtenerInfoCarrito = async (req, res) => {
  try {
    console.log('📊 [CARRITO] Obteniendo información detallada del carrito');
    
    const usuario_id = req.user.usuario_id;
    const carritoUsuario = carritosSesiones.get(usuario_id) || { 
      items: [], 
      proveedor_id: null 
    };
    
    // Estadísticas del carrito
    const estadisticas = {
      totalItems: carritoUsuario.items?.length || 0,
      totalCantidad: carritoUsuario.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0,
      totalEstimado: carritoUsuario.items?.reduce((sum, item) => sum + (item.cantidad * (item.precio_estimado || 0)), 0) || 0,
      itemsCriticos: carritoUsuario.items?.filter(item => item.stock_actual === 0).length || 0,
      tieneProveedor: !!carritoUsuario.proveedor_id
    };
    
    const info = {
      carrito: carritoUsuario,
      estadisticas,
      usuario_id,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [CARRITO] Información detallada obtenida');
    return ApiResponse.success(res, info, 'Información del carrito obtenida exitosamente');

  } catch (error) {
    console.error('❌ [CARRITO] Error al obtener información del carrito:', error);
    return ApiResponse.error(res, 'Error al obtener información del carrito', 500);
  }
};