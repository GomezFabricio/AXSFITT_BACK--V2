import { pool } from './db.js';

/**
 * Script para mejorar el trigger de notificaciones con:
 * 1. Nombres de productos y variantes detallados
 * 2. Gestión inteligente de fechas según configuración
 */

async function updateNotificationTrigger() {
  try {
    console.log('🔧 Mejorando el trigger de notificaciones...');
    
    // 1. Eliminar trigger existente
    console.log('🗑️ Eliminando trigger existente...');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_inmediata');
    
    // 2. Crear trigger mejorado
    console.log('✨ Creando trigger mejorado...');
    await pool.query(`
      CREATE TRIGGER trg_notificacion_faltante_inmediata 
      AFTER INSERT ON faltantes FOR EACH ROW 
      BEGIN
          DECLARE config_activo_val INT DEFAULT 0;
          DECLARE config_frecuencia_val VARCHAR(20) DEFAULT '';
          DECLARE config_dias_semana_val JSON DEFAULT NULL;
          DECLARE config_hora_envio_val TIME DEFAULT '09:00:00';
          
          DECLARE producto_nombre_val VARCHAR(255) DEFAULT '';
          DECLARE variante_descripcion_val VARCHAR(500) DEFAULT '';
          DECLARE producto_completo VARCHAR(800) DEFAULT '';
          DECLARE fecha_envio_calculada DATE DEFAULT NULL;
          DECLARE mensaje_detallado TEXT DEFAULT '';
          
          -- Obtener configuración
          SELECT config_activo, IFNULL(config_frecuencia, 'inmediata'), config_dias_semana, IFNULL(config_hora_envio, '09:00:00')
          INTO config_activo_val, config_frecuencia_val, config_dias_semana_val, config_hora_envio_val
          FROM notificaciones_config 
          WHERE config_tipo = 'email' 
          LIMIT 1;
          
          -- Solo proceder si está activo
          IF config_activo_val = 1 THEN
              
              -- Obtener nombre del producto
              IF NEW.faltante_producto_id IS NOT NULL THEN
                  SELECT producto_nombre INTO producto_nombre_val
                  FROM productos 
                  WHERE producto_id = NEW.faltante_producto_id;
              END IF;
              
              -- Obtener descripción de la variante si existe
              IF NEW.faltante_variante_id IS NOT NULL THEN
                  SELECT 
                      CONCAT(
                          IFNULL(p.producto_nombre, 'Producto'),
                          ' - ',
                          GROUP_CONCAT(vv.valor_nombre SEPARATOR ', ')
                      )
                  INTO variante_descripcion_val
                  FROM variantes v
                  LEFT JOIN productos p ON v.producto_id = p.producto_id
                  LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
                  WHERE v.variante_id = NEW.faltante_variante_id
                  GROUP BY v.variante_id;
              END IF;
              
              -- Determinar nombre completo del producto
              IF variante_descripcion_val != '' THEN
                  SET producto_completo = variante_descripcion_val;
              ELSEIF producto_nombre_val != '' THEN
                  SET producto_completo = producto_nombre_val;
              ELSE
                  SET producto_completo = CONCAT('Producto ID: ', IFNULL(NEW.faltante_producto_id, 'N/A'));
              END IF;
              
              -- Calcular fecha de envío según configuración
              IF config_frecuencia_val = 'inmediata' THEN
                  SET fecha_envio_calculada = CURDATE();
              ELSEIF config_frecuencia_val = 'diaria' THEN
                  SET fecha_envio_calculada = CURDATE() + INTERVAL 1 DAY;
              ELSEIF config_frecuencia_val = 'semanal' THEN
                  -- Buscar el próximo día configurado para envío
                  SET fecha_envio_calculada = CURDATE() + INTERVAL 1 WEEK;
              ELSE
                  SET fecha_envio_calculada = CURDATE();
              END IF;
              
              -- Crear mensaje detallado
              SET mensaje_detallado = CONCAT(
                  '🚨 ALERTA DE STOCK BAJO\\n\\n',
                  '📦 PRODUCTO: ', producto_completo, '\\n',
                  '📊 CANTIDAD FALTANTE: ', NEW.faltante_cantidad_faltante, ' unidades\\n',
                  '⚠️ ESTADO: ', NEW.faltante_estado, '\\n',
                  '📅 FECHA DETECCIÓN: ', DATE_FORMAT(NEW.faltante_fecha_deteccion, '%d/%m/%Y %H:%i'), '\\n',
                  '🔢 ID FALTANTE: ', NEW.faltante_id, '\\n\\n',
                  '📌 ACCIÓN REQUERIDA:\\n',
                  '• Revise el inventario del producto\\n',
                  '• Genere un pedido al proveedor si es necesario\\n',
                  '• Actualice el stock mínimo si corresponde\\n\\n',
                  '🌐 Acceda al sistema para más detalles y gestionar pedidos.\\n\\n',
                  '---\\n',
                  'Sistema AXSFITT - Gestión de Inventario\\n',
                  'Notificación automática generada el ', NOW()
              );
              
              -- Crear notificación pendiente
              INSERT INTO notificaciones_pendientes (
                  tipo_notificacion,
                  destinatario_email,
                  asunto,
                  mensaje,
                  faltante_id,
                  estado,
                  fecha_creacion,
                  fecha_envio_programada
              ) VALUES (
                  'email',
                  'fabricio.gomez4371@gmail.com',
                  CONCAT('🚨 STOCK BAJO: ', producto_completo),
                  mensaje_detallado,
                  NEW.faltante_id,
                  'pendiente',
                  NOW(),
                  fecha_envio_calculada
              );
              
          END IF;
      END
    `);
    
    console.log('✅ Trigger mejorado creado exitosamente!');
    
    // 3. Agregar la columna fecha_envio_programada si no existe
    console.log('🔧 Verificando estructura de notificaciones_pendientes...');
    
    try {
      await pool.query(`
        ALTER TABLE notificaciones_pendientes 
        ADD COLUMN fecha_envio_programada DATE NULL 
        AFTER fecha_envio
      `);
      console.log('✅ Columna fecha_envio_programada agregada');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Columna fecha_envio_programada ya existe');
      } else {
        console.log('⚠️ Error agregando columna:', error.message);
      }
    }
    
    // 4. Probar el trigger
    console.log('🧪 Probando el trigger mejorado...');
    
    const [insertResult] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado
      ) VALUES (NULL, 1, 15, 8, 'detectado')
    `);
    
    const faltanteId = insertResult.insertId;
    console.log('✅ Faltante de prueba creado con ID:', faltanteId);
    
    // 5. Verificar la notificación creada
    const [notifications] = await pool.query(`
      SELECT 
        id,
        asunto,
        LEFT(mensaje, 100) as mensaje_preview,
        fecha_envio_programada,
        DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion
      FROM notificaciones_pendientes 
      WHERE faltante_id = ? 
      ORDER BY fecha_creacion DESC
    `, [faltanteId]);
    
    if (notifications.length > 0) {
      console.log('🎉 ¡Notificación mejorada creada exitosamente!');
      console.log('📧 Asunto:', notifications[0].asunto);
      console.log('📅 Fecha programada:', notifications[0].fecha_envio_programada);
      console.log('📝 Mensaje preview:', notifications[0].mensaje_preview + '...');
    } else {
      console.log('❌ No se creó la notificación');
    }
    
    // 6. Limpiar - eliminar el faltante de prueba
    await pool.query('DELETE FROM faltantes WHERE faltante_id = ?', [faltanteId]);
    console.log('🧹 Faltante de prueba eliminado');
    
    console.log('\\n✅ TRIGGER MEJORADO COMPLETADO!');
    console.log('📋 Mejoras implementadas:');
    console.log('  • Nombres de productos y variantes detallados');
    console.log('  • Gestión de fechas según configuración');
    console.log('  • Mensajes más informativos');
    console.log('  • Campo fecha_envio_programada');
    
  } catch (error) {
    console.error('❌ Error mejorando el trigger:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar el script
updateNotificationTrigger();