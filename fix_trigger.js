import { pool } from './db.js';

/**
 * Script para corregir el trigger de notificaciones de faltantes
 * Problema: El trigger no incluye el campo tipo_notificacion que es requerido
 */

async function fixNotificationTrigger() {
  try {
    console.log('🔧 Iniciando corrección del trigger de notificaciones...');
    
    // 1. Actualizar configuración de email para tener frecuencia válida
    console.log('📋 Actualizando configuración de email...');
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata' 
      WHERE config_tipo = 'email' AND config_frecuencia IS NULL
    `);
    
    // 2. Eliminar trigger existente
    console.log('🗑️ Eliminando trigger existente...');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_inmediata');
    
    // 3. Crear trigger corregido
    console.log('✨ Creando trigger corregido...');
    await pool.query(`
      CREATE TRIGGER trg_notificacion_faltante_inmediata 
      AFTER INSERT ON faltantes FOR EACH ROW 
      BEGIN
          DECLARE config_activo_val INT DEFAULT 0;
          DECLARE config_frecuencia_val VARCHAR(20) DEFAULT '';
          
          -- Obtener configuración (manejar NULL en frecuencia)
          SELECT config_activo, IFNULL(config_frecuencia, 'inmediata') 
          INTO config_activo_val, config_frecuencia_val
          FROM notificaciones_config 
          WHERE config_tipo = 'email' 
          LIMIT 1;
          
          -- Si está activo y es inmediata, crear notificación
          IF config_activo_val = 1 AND config_frecuencia_val = 'inmediata' THEN
              INSERT INTO notificaciones_pendientes (
                  tipo_notificacion,
                  destinatario_email,
                  asunto,
                  mensaje,
                  faltante_id,
                  estado,
                  fecha_creacion
              ) VALUES (
                  'email',
                  'fabricio.gomez4371@gmail.com',
                  CONCAT('🚨 ALERTA: Nuevo faltante detectado'),
                  CONCAT(
                      'Se ha detectado un nuevo faltante en el inventario.\\n\\n',
                      'Detalles:\\n',
                      '• ID: ', NEW.faltante_id, '\\n',
                      '• Cantidad faltante: ', NEW.faltante_cantidad_faltante, ' unidades\\n',
                      '• Estado: ', NEW.faltante_estado, '\\n',
                      '• Fecha: ', NEW.faltante_fecha_deteccion, '\\n\\n',
                      'Ingrese al sistema para revisar los detalles y generar pedidos.\\n\\n',
                      'Sistema AXSFITT'
                  ),
                  NEW.faltante_id,
                  'pendiente',
                  NOW()
              );
          END IF;
      END
    `);
    
    // 4. Verificar configuración actual
    console.log('🔍 Verificando configuración actual...');
    const [config] = await pool.query(`
      SELECT config_tipo, config_activo, config_frecuencia 
      FROM notificaciones_config 
      WHERE config_tipo = 'email'
    `);
    
    console.log('📊 Configuración actual:', config);
    
    // 5. Probar el trigger insertando un faltante de prueba
    console.log('🧪 Probando el trigger con inserción de faltante...');
    
    const [insertResult] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado
      ) VALUES (NULL, 1, 10, 5, 'detectado')
    `);
    
    const faltanteId = insertResult.insertId;
    console.log('✅ Faltante de prueba creado con ID:', faltanteId);
    
    // 6. Verificar si se creó la notificación
    const [notifications] = await pool.query(`
      SELECT * FROM notificaciones_pendientes 
      WHERE faltante_id = ? 
      ORDER BY fecha_creacion DESC
    `, [faltanteId]);
    
    if (notifications.length > 0) {
      console.log('🎉 ¡SUCCESS! Notificación creada correctamente:');
      console.log('📧 Email:', notifications[0].destinatario_email);
      console.log('📝 Asunto:', notifications[0].asunto);
      console.log('📅 Fecha:', notifications[0].fecha_creacion);
    } else {
      console.log('❌ No se creó la notificación. Revisar configuración.');
    }
    
    // 7. Limpiar - eliminar el faltante de prueba
    await pool.query('DELETE FROM faltantes WHERE faltante_id = ?', [faltanteId]);
    console.log('🧹 Faltante de prueba eliminado');
    
    console.log('✅ Corrección del trigger completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error corrigiendo el trigger:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar el script
fixNotificationTrigger();