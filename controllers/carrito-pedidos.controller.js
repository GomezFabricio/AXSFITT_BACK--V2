import { ApiResponse } from '../utils/apiResponse.js';
import { pool } from '../db.js';

/**
 * Controlador para gestión de Carrito de Pedido Rápido
 * Permite agregar productos/variantes faltantes a un carrito temporal
 * y generar pedidos de reposición automáticamente
 */

// Variable temporal para simular sesiones de carrito (en producción usar Redis o session storage)
const carritosSesiones = new Map();

// Obtener carrito actual de la sesión
export const obtenerCarrito = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    const carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    
    return ApiResponse.success(res, carritoUsuario, 'Carrito obtenido exitosamente');
  } catch (error) {
    console.error('❌ Error al obtener carrito:', error);
    return ApiResponse.manejarErrorDB(error, res, 'obtener carrito');
  }
};

// Agregar faltante al carrito
export const agregarAlCarrito = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    const { faltante_id, producto_id, variante_id, cantidad_necesaria } = req.body;

    // Validar que se proporcione al menos producto_id o variante_id
    if (!producto_id && !variante_id) {
      return ApiResponse.error(res, 'Debe especificar producto_id o variante_id', 400);
    }

    // Obtener información del producto/variante
    let itemInfo;
    if (variante_id) {
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
          GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
          ip.imagen_url
        FROM variantes v
        JOIN productos p ON v.producto_id = p.producto_id
        LEFT JOIN stock s ON s.variante_id = v.variante_id
        LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
        LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
        LEFT JOIN imagenes_productos ip ON ip.imagen_id = v.imagen_id
        WHERE v.variante_id = ?
        GROUP BY v.variante_id
      `, [variante_id]);
      
      if (!rows.length) {
        return ApiResponse.error(res, 'Variante no encontrada', 404);
      }
      itemInfo = { ...rows[0], tipo: 'variante' };
    } else {
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
        WHERE p.producto_id = ?
      `, [producto_id]);
      
      if (!rows.length) {
        return ApiResponse.error(res, 'Producto no encontrado', 404);
      }
      itemInfo = { ...rows[0], tipo: 'producto' };
    }

    // Calcular cantidad faltante si no se especifica
    const cantidadFaltante = cantidad_necesaria || 
      Math.max(0, itemInfo.stock_minimo - itemInfo.stock_actual);

    // Obtener carrito actual del usuario
    let carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };

    // Verificar si el item ya existe en el carrito
    const itemKey = variante_id ? `variante_${variante_id}` : `producto_${producto_id}`;
    const itemExistente = carritoUsuario.items.find(item => item.key === itemKey);

    if (itemExistente) {
      // Actualizar cantidad
      itemExistente.cantidad = cantidadFaltante;
    } else {
      // Agregar nuevo item
      carritoUsuario.items.push({
        key: itemKey,
        faltante_id,
        producto_id: itemInfo.producto_id,
        variante_id: variante_id || null,
        producto_nombre: itemInfo.producto_nombre,
        variante_sku: itemInfo.variante_sku || null,
        atributos: itemInfo.atributos || null,
        cantidad: cantidadFaltante,
        stock_actual: itemInfo.stock_actual,
        stock_minimo: itemInfo.stock_minimo,
        imagen_url: itemInfo.imagen_url,
        tipo: itemInfo.tipo,
        precio_estimado: itemInfo.variante_precio_venta || 0
      });
    }

    // Guardar carrito actualizado
    carritosSesiones.set(usuario_id, carritoUsuario);

    return ApiResponse.success(res, carritoUsuario, 'Producto agregado al carrito exitosamente');
  } catch (error) {
    console.error('❌ Error al agregar al carrito:', error);
    return ApiResponse.manejarErrorDB(error, res, 'agregar al carrito');
  }
};

// Quitar item del carrito
export const quitarDelCarrito = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    const { item_key } = req.body;

    let carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    
    // Filtrar el item a eliminar
    carritoUsuario.items = carritoUsuario.items.filter(item => item.key !== item_key);
    
    // Guardar carrito actualizado
    carritosSesiones.set(usuario_id, carritoUsuario);

    return ApiResponse.success(res, carritoUsuario, 'Producto eliminado del carrito exitosamente');
  } catch (error) {
    console.error('❌ Error al quitar del carrito:', error);
    return ApiResponse.manejarErrorDB(error, res, 'quitar del carrito');
  }
};

// Actualizar cantidad en carrito
export const actualizarCantidadCarrito = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    const { item_key, cantidad } = req.body;

    if (cantidad <= 0) {
      return ApiResponse.error(res, 'La cantidad debe ser mayor a 0', 400);
    }

    let carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    
    // Buscar y actualizar el item
    const item = carritoUsuario.items.find(item => item.key === item_key);
    if (item) {
      item.cantidad = cantidad;
    } else {
      return ApiResponse.error(res, 'Item no encontrado en el carrito', 404);
    }
    
    // Guardar carrito actualizado
    carritosSesiones.set(usuario_id, carritoUsuario);

    return ApiResponse.success(res, carritoUsuario, 'Cantidad actualizada exitosamente');
  } catch (error) {
    console.error('❌ Error al actualizar cantidad:', error);
    return ApiResponse.manejarErrorDB(error, res, 'actualizar cantidad');
  }
};

// Seleccionar proveedor para el carrito
export const seleccionarProveedor = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    const { proveedor_id } = req.body;

    // Verificar que el proveedor existe
    const [proveedor] = await pool.query(
      'SELECT proveedor_id, proveedor_nombre FROM proveedores WHERE proveedor_id = ? AND proveedor_estado = "activo"',
      [proveedor_id]
    );

    if (!proveedor.length) {
      return ApiResponse.error(res, 'Proveedor no encontrado o inactivo', 404);
    }

    let carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };
    carritoUsuario.proveedor_id = proveedor_id;
    carritoUsuario.proveedor_nombre = proveedor[0].proveedor_nombre;
    
    // Guardar carrito actualizado
    carritosSesiones.set(usuario_id, carritoUsuario);

    return ApiResponse.success(res, carritoUsuario, 'Proveedor seleccionado exitosamente');
  } catch (error) {
    console.error('❌ Error al seleccionar proveedor:', error);
    return ApiResponse.manejarErrorDB(error, res, 'seleccionar proveedor');
  }
};

// Obtener lista de proveedores activos
export const obtenerProveedores = async (req, res) => {
  try {
    const [proveedores] = await pool.query(`
      SELECT 
        proveedor_id,
        proveedor_nombre,
        proveedor_contacto,
        proveedor_email
      FROM proveedores 
      WHERE proveedor_estado = 'activo'
      ORDER BY proveedor_nombre
    `);

    return ApiResponse.success(res, proveedores, 'Proveedores obtenidos exitosamente');
  } catch (error) {
    console.error('❌ Error al obtener proveedores:', error);
    return ApiResponse.manejarErrorDB(error, res, 'obtener proveedores');
  }
};

// Vaciar carrito
export const vaciarCarrito = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    
    // Limpiar carrito del usuario
    carritosSesiones.set(usuario_id, { items: [], proveedor_id: null });

    return ApiResponse.success(res, { items: [], proveedor_id: null }, 'Carrito vaciado exitosamente');
  } catch (error) {
    console.error('❌ Error al vaciar carrito:', error);
    return ApiResponse.manejarErrorDB(error, res, 'vaciar carrito');
  }
};

// Confirmar pedido desde carrito
export const crearPedidoDesdeCarrito = async (req, res) => {
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const usuario_id = req.user.usuario_id;
    const carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };

    // Validaciones
    if (!carritoUsuario.items.length) {
      return ApiResponse.error(res, 'El carrito está vacío', 400);
    }

    if (!carritoUsuario.proveedor_id) {
      return ApiResponse.error(res, 'Debe seleccionar un proveedor', 400);
    }

    // Calcular total del pedido
    let total = carritoUsuario.items.reduce((sum, item) => {
      return sum + (item.cantidad * (item.precio_estimado || 0));
    }, 0);

    // Crear pedido principal
    const [resultPedido] = await conn.query(`
      INSERT INTO pedidos (
        pedido_proveedor_id,
        pedido_usuario_id,
        pedido_estado,
        pedido_fecha_pedido,
        pedido_total,
        pedido_descuento,
        pedido_costo_envio,
        pedido_observaciones
      ) VALUES (?, ?, 'pendiente', NOW(), ?, 0, 0, ?)
    `, [
      carritoUsuario.proveedor_id,
      usuario_id,
      total,
      'Pedido generado desde carrito rápido de faltantes'
    ]);

    const pedido_id = resultPedido.insertId;

    // Crear detalles del pedido
    for (const item of carritoUsuario.items) {
      await conn.query(`
        INSERT INTO pedidos_detalle (
          pd_pedido_id,
          pd_producto_id,
          pd_variante_id,
          pd_cantidad_pedida,
          pd_precio_unitario
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        pedido_id,
        item.tipo === 'producto' ? item.producto_id : null,
        item.tipo === 'variante' ? item.variante_id : null,
        item.cantidad,
        item.precio_estimado || 0
      ]);

      // Actualizar estado del faltante si existe
      if (item.faltante_id) {
        const cantidadSolicitada = item.cantidad;
        const cantidadFaltante = Math.max(0, item.stock_minimo - item.stock_actual);
        
        let nuevoEstado;
        if (cantidadSolicitada >= cantidadFaltante) {
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
        `, [nuevoEstado, cantidadSolicitada, pedido_id, item.faltante_id]);
      }
    }

    await conn.commit();

    // Limpiar carrito después de crear el pedido
    carritosSesiones.set(usuario_id, { items: [], proveedor_id: null });

    return ApiResponse.success(res, {
      pedido_id,
      mensaje: 'Pedido creado exitosamente',
      items_procesados: carritoUsuario.items.length,
      total
    }, 'Pedido de reposición creado exitosamente');

  } catch (error) {
    await conn.rollback();
    console.error('❌ Error al crear pedido desde carrito:', error);
    return ApiResponse.manejarErrorDB(error, res, 'crear pedido desde carrito');
  } finally {
    conn.release();
  }
};

// Agregar todos los faltantes al carrito
export const agregarTodosFaltantes = async (req, res) => {
  try {
    const usuario_id = req.user.usuario_id;
    
    // Obtener todos los faltantes detectados
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
        GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') AS atributos,
        
        -- Stock actual
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            (SELECT s2.cantidad FROM stock s2 WHERE s2.variante_id = f.faltante_variante_id)
          WHEN f.faltante_producto_id IS NOT NULL THEN 
            (SELECT s2.cantidad FROM stock s2 WHERE s2.producto_id = f.faltante_producto_id)
          ELSE 0
        END AS stock_actual,
        
        -- Stock mínimo
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            (SELECT s2.stock_minimo FROM stock s2 WHERE s2.variante_id = f.faltante_variante_id)
          WHEN f.faltante_producto_id IS NOT NULL THEN 
            (SELECT s2.stock_minimo FROM stock s2 WHERE s2.producto_id = f.faltante_producto_id)
          ELSE 0
        END AS stock_minimo,
        
        -- Imagen
        CASE 
          WHEN f.faltante_variante_id IS NOT NULL THEN ip2.imagen_url
          WHEN f.faltante_producto_id IS NOT NULL THEN ip.imagen_url
          ELSE NULL
        END AS imagen_url
        
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

    if (!faltantes.length) {
      return ApiResponse.success(res, { items: [], mensaje: 'No hay faltantes pendientes para agregar' });
    }

    // Obtener carrito actual
    let carritoUsuario = carritosSesiones.get(usuario_id) || { items: [], proveedor_id: null };

    // Agregar cada faltante al carrito
    for (const faltante of faltantes) {
      const itemKey = faltante.variante_id ? `variante_${faltante.variante_id}` : `producto_${faltante.producto_id}`;
      
      // Verificar si ya existe
      const itemExistente = carritoUsuario.items.find(item => item.key === itemKey);
      
      if (!itemExistente) {
        carritoUsuario.items.push({
          key: itemKey,
          faltante_id: faltante.faltante_id,
          producto_id: faltante.producto_id,
          variante_id: faltante.variante_id,
          producto_nombre: faltante.producto_nombre,
          variante_sku: faltante.variante_sku,
          atributos: faltante.atributos,
          cantidad: faltante.cantidad_faltante || Math.max(0, faltante.stock_minimo - faltante.stock_actual),
          stock_actual: faltante.stock_actual,
          stock_minimo: faltante.stock_minimo,
          imagen_url: faltante.imagen_url,
          tipo: faltante.variante_id ? 'variante' : 'producto',
          precio_estimado: 0
        });
      }
    }

    // Guardar carrito actualizado
    carritosSesiones.set(usuario_id, carritoUsuario);

    return ApiResponse.success(res, {
      carrito: carritoUsuario,
      faltantes_agregados: faltantes.length,
      mensaje: `${faltantes.length} faltantes agregados al carrito`
    }, 'Todos los faltantes agregados exitosamente');

  } catch (error) {
    console.error('❌ Error al agregar todos los faltantes:', error);
    return ApiResponse.manejarErrorDB(error, res, 'agregar todos los faltantes');
  }
};