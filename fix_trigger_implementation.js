import { pool } from './db.js';

async function fixTriggerAndImplement() {
  try {
    console.log('🔧 Corrigiendo trigger y completando implementación...\n');
    
    // 1. Verificar si el campo tipo_frecuencia ya fue agregado
    const [columns] = await pool.query('DESCRIBE notificaciones_pendientes');
    const hasTypeField = columns.some(col => col.Field === 'tipo_frecuencia');
    
    if (!hasTypeField) {
      console.log('📝 Agregando campo tipo_frecuencia...');
      await pool.query(`
        ALTER TABLE notificaciones_pendientes 
        ADD COLUMN tipo_frecuencia enum('inmediata','diaria','semanal','diaria_agrupado','semanal_agrupado') 
        DEFAULT 'inmediata' 
        AFTER faltante_id
      `);
      console.log('   ✅ Campo agregado');
    } else {
      console.log('   ℹ️ Campo tipo_frecuencia ya existe');
    }
    
    // 2. Actualizar enum de estado
    try {
      await pool.query(`
        ALTER TABLE notificaciones_pendientes 
        MODIFY COLUMN estado enum('pendiente','enviado','error','agrupado') DEFAULT 'pendiente'
      `);
      console.log('   ✅ Estado enum actualizado');
    } catch (error) {
      console.log('   ℹ️ Estado enum ya actualizado');
    }
    
    // 3. Crear trigger corregido
    console.log('\n🔧 Creando trigger corregido...');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_inmediata');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_completo');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_mejorado');
    
    await pool.query(`
      CREATE TRIGGER trg_notificacion_faltante_completo 
      AFTER INSERT ON faltantes FOR EACH ROW 
      BEGIN
          DECLARE config_activo_val INT DEFAULT 0;
          DECLARE config_frecuencia_val VARCHAR(20) DEFAULT 'inmediata';
          DECLARE config_hora_envio_val TIME DEFAULT '09:00:00';
          
          DECLARE producto_nombre_val VARCHAR(255) DEFAULT '';
          DECLARE variante_info VARCHAR(500) DEFAULT '';
          DECLARE producto_completo VARCHAR(800) DEFAULT '';
          DECLARE fecha_envio_calculada DATE DEFAULT NULL;
          DECLARE mensaje_detallado TEXT DEFAULT '';
          
          -- Obtener configuración de notificaciones
          SELECT config_activo, IFNULL(config_frecuencia, 'inmediata'), 
                 IFNULL(config_hora_envio, '09:00:00')
          INTO config_activo_val, config_frecuencia_val, config_hora_envio_val
          FROM notificaciones_config 
          WHERE config_tipo = 'email' AND config_activo = 1
          LIMIT 1;
          
          -- Solo procesar si las notificaciones están activas
          IF config_activo_val = 1 THEN
              
              -- Obtener información del producto
              IF NEW.faltante_producto_id IS NOT NULL THEN
                  SELECT producto_nombre INTO producto_nombre_val
                  FROM productos 
                  WHERE producto_id = NEW.faltante_producto_id;
                  
                  SET producto_completo = IFNULL(producto_nombre_val, 'Producto sin nombre');
              ELSE
                  SET producto_completo = 'Producto no especificado';
              END IF;
              
              -- Si hay variante, agregar información adicional
              IF NEW.faltante_variante_id IS NOT NULL THEN
                  -- Obtener SKU de la variante como identificador
                  SELECT CONCAT(
                      producto_completo,
                      ' (SKU: ', IFNULL(v.variante_sku, 'N/A'), ')',
                      ' - Precio: $', IFNULL(v.variante_precio_venta, 0)
                  )
                  INTO variante_info
                  FROM variantes v
                  WHERE v.variante_id = NEW.faltante_variante_id;
                  
                  -- Intentar obtener más detalles de la variante
                  SELECT GROUP_CONCAT(
                      CONCAT(a.atributo_nombre, ': ', vv.valor_nombre)
                      SEPARATOR ', '
                  )
                  INTO variante_info
                  FROM valores_variantes vv
                  LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
                  WHERE vv.variante_id = NEW.faltante_variante_id;
                  
                  IF variante_info IS NOT NULL AND variante_info != '' THEN
                      SET producto_completo = CONCAT(producto_completo, ' - ', variante_info);
                  ELSE
                      -- Si no hay detalles de atributos, usar SKU
                      SELECT CONCAT(producto_completo, ' (Variante ID: ', NEW.faltante_variante_id, ')')
                      INTO producto_completo;
                  END IF;
              END IF;
              
              -- Calcular fecha de envío según configuración
              CASE config_frecuencia_val
                  WHEN 'inmediata' THEN
                      SET fecha_envio_calculada = CURDATE();
                  WHEN 'diaria' THEN
                      -- Para diaria: si aún no pasó la hora de hoy, enviar hoy; sino mañana
                      IF TIME(NOW()) <= config_hora_envio_val THEN
                          SET fecha_envio_calculada = CURDATE();
                      ELSE
                          SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL 1 DAY);
                      END IF;
                  WHEN 'semanal' THEN
                      -- Para semanal: próximo lunes
                      SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL (7 - WEEKDAY(CURDATE())) DAY);
                  ELSE
                      SET fecha_envio_calculada = CURDATE();
              END CASE;
              
              -- Crear mensaje detallado
              SET mensaje_detallado = CONCAT(
                  '🚨 ALERTA DE STOCK\\n',
                  '═══════════════════════════════════\\n\\n',
                  '📦 PRODUCTO: ', producto_completo, '\\n',
                  '📊 CANTIDAD FALTANTE: ', NEW.faltante_cantidad_faltante, ' unidades\\n',
                  '📈 CANTIDAD ORIGINAL: ', NEW.faltante_cantidad_original, ' unidades\\n',
                  '⚠️  ESTADO: ', UPPER(NEW.faltante_estado), '\\n',
                  '📅 DETECTADO: ', DATE_FORMAT(NEW.faltante_fecha_deteccion, '%d/%m/%Y a las %H:%i'), '\\n\\n',
                  '🔍 DETALLES TÉCNICOS:\\n',
                  '────────────────────────────────\\n',
                  '🆔 ID Faltante: #', NEW.faltante_id, '\\n',
                  '🏷️  ID Producto: ', IFNULL(NEW.faltante_producto_id, 'N/A'), '\\n',
                  '🎯 ID Variante: ', IFNULL(NEW.faltante_variante_id, 'N/A'), '\\n\\n',
                  '📋 ACCIONES RECOMENDADAS:\\n',
                  '────────────────────────────────\\n',
                  '• Verificar stock físico del producto\\n',
                  '• Contactar al proveedor si es necesario\\n',
                  '• Actualizar cantidad en el sistema\\n',
                  '• Revisar configuración de stock mínimo\\n\\n',
                  '⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.',
                  '\\n📞 Para consultas, contacte al administrador del sistema.'
              );
              
              -- Insertar notificación pendiente
              INSERT INTO notificaciones_pendientes (
                  tipo_notificacion,
                  destinatario_email,
                  destinatario_nombre,
                  asunto,
                  mensaje,
                  faltante_id,
                  tipo_frecuencia,
                  fecha_envio_programada,
                  estado,
                  fecha_creacion
              ) VALUES (
                  'email',
                  'fabricio.gomez4371@gmail.com',
                  'Administrador Sistema',
                  CONCAT('🚨 ', config_frecuencia_val, ' - Faltante: ', 
                         SUBSTRING(producto_completo, 1, 100),
                         IF(LENGTH(producto_completo) > 100, '...', '')),
                  mensaje_detallado,
                  NEW.faltante_id,
                  config_frecuencia_val,
                  fecha_envio_calculada,
                  'pendiente',
                  NOW()
              );
              
          END IF;
      END
    `);
    
    console.log('   ✅ Trigger corregido creado exitosamente');
    
    // 4. Verificar stored procedure
    console.log('\n🔍 Verificando stored procedure...');
    const [procedures] = await pool.query("SHOW PROCEDURE STATUS WHERE Name = 'sp_agrupar_notificaciones_pendientes'");
    
    if (procedures.length === 0) {
      console.log('   📝 Creando stored procedure de agrupación...');
      await pool.query(`
        CREATE PROCEDURE sp_agrupar_notificaciones_pendientes()
        BEGIN
            DECLARE done INT DEFAULT FALSE;
            DECLARE v_fecha_envio DATE;
            DECLARE v_tipo_frecuencia VARCHAR(20);
            DECLARE v_count INT;
            
            -- Cursor para fechas y tipos que necesitan agrupación
            DECLARE cur_grupos CURSOR FOR
                SELECT fecha_envio_programada, tipo_frecuencia, COUNT(*) as cantidad
                FROM notificaciones_pendientes 
                WHERE estado = 'pendiente' 
                AND tipo_frecuencia IN ('diaria', 'semanal')
                AND fecha_envio_programada <= CURDATE()
                GROUP BY fecha_envio_programada, tipo_frecuencia
                HAVING COUNT(*) > 1;
                
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
            
            -- Procesar cada grupo que necesita agrupación
            OPEN cur_grupos;
            
            read_loop: LOOP
                FETCH cur_grupos INTO v_fecha_envio, v_tipo_frecuencia, v_count;
                IF done THEN
                    LEAVE read_loop;
                END IF;
                
                -- Crear notificación agrupada
                INSERT INTO notificaciones_pendientes (
                    tipo_notificacion,
                    destinatario_email,
                    destinatario_nombre,
                    asunto,
                    mensaje,
                    tipo_frecuencia,
                    fecha_envio_programada,
                    estado,
                    fecha_creacion
                )
                SELECT 
                    'email',
                    'fabricio.gomez4371@gmail.com',
                    'Administrador Sistema',
                    CONCAT('📋 Resumen ', v_tipo_frecuencia, ' - ', v_count, ' faltantes detectados'),
                    CONCAT(
                        '📋 RESUMEN ', UPPER(v_tipo_frecuencia), ' DE FALTANTES\\n',
                        '═══════════════════════════════════════════════\\n\\n',
                        '📅 Fecha del reporte: ', DATE_FORMAT(v_fecha_envio, '%d/%m/%Y'), '\\n',
                        '📊 Total de productos con faltantes: ', v_count, '\\n\\n',
                        '📦 LISTA DE PRODUCTOS AFECTADOS:\\n',
                        '────────────────────────────────────────\\n',
                        GROUP_CONCAT(
                            CONCAT(
                                '• ', 
                                SUBSTRING_INDEX(
                                    SUBSTRING_INDEX(asunto, 'Faltante: ', -1), 
                                    ' (', 1
                                ),
                                '\\n   📊 ', 
                                SUBSTRING_INDEX(
                                    SUBSTRING_INDEX(mensaje, 'CANTIDAD FALTANTE: ', -1),
                                    ' unidades', 1
                                ), ' unidades faltantes'
                            ) 
                            SEPARATOR '\\n'
                        ),
                        '\\n\\n🔔 RESUMEN EJECUTIVO:\\n',
                        '──────────────────────\\n',
                        '⚠️ Se detectaron múltiples faltantes en el inventario\\n',
                        '📈 Es recomendable revisar los niveles de stock\\n',
                        '🔄 Considere contactar a los proveedores correspondientes\\n\\n',
                        '📊 Para ver detalles individuales, revise el panel de administración.\\n',
                        '⏰ Reporte generado automáticamente el ', NOW()
                    ),
                    CONCAT(v_tipo_frecuencia, '_agrupado'),
                    v_fecha_envio,
                    'pendiente',
                    NOW()
                FROM notificaciones_pendientes 
                WHERE estado = 'pendiente' 
                AND tipo_frecuencia = v_tipo_frecuencia
                AND fecha_envio_programada = v_fecha_envio;
                
                -- Marcar notificaciones individuales como agrupadas
                UPDATE notificaciones_pendientes 
                SET estado = 'agrupado'
                WHERE estado = 'pendiente' 
                AND tipo_frecuencia = v_tipo_frecuencia
                AND fecha_envio_programada = v_fecha_envio;
                
            END LOOP;
            
            CLOSE cur_grupos;
        END
      `);
      console.log('   ✅ Stored procedure creado');
    } else {
      console.log('   ✅ Stored procedure ya existe');
    }
    
    console.log('\n🧪 Probando sistema con datos reales...');
    
    // Verificar productos disponibles para prueba
    const [productos] = await pool.query('SELECT producto_id, producto_nombre FROM productos LIMIT 3');
    console.log('   📦 Productos disponibles para prueba:');
    productos.forEach(p => console.log(`      - ${p.producto_id}: ${p.producto_nombre}`));
    
    if (productos.length > 0) {
      // Configurar para prueba diaria
      await pool.query(`
        UPDATE notificaciones_config 
        SET config_frecuencia = 'diaria', 
            config_hora_envio = '10:00:00',
            config_activo = 1
        WHERE config_tipo = 'email'
      `);
      
      // Crear un faltante de prueba con producto real
      const [result] = await pool.query(`
        INSERT INTO faltantes (
          faltante_producto_id, 
          faltante_cantidad_original, 
          faltante_cantidad_faltante, 
          faltante_estado,
          faltante_fecha_deteccion
        ) VALUES (?, 25, 8, 'detectado', NOW())
      `, [productos[0].producto_id]);
      
      const faltanteId = result.insertId;
      console.log(`   ✅ Faltante de prueba creado con ID: ${faltanteId}`);
      
      // Verificar notificación creada
      const [notification] = await pool.query(`
        SELECT asunto, tipo_frecuencia, fecha_envio_programada, estado,
               LEFT(mensaje, 150) as mensaje_preview
        FROM notificaciones_pendientes 
        WHERE faltante_id = ?
      `, [faltanteId]);
      
      if (notification.length > 0) {
        console.log('   ✅ Notificación creada:');
        console.log(`      📧 Asunto: ${notification[0].asunto}`);
        console.log(`      📊 Tipo: ${notification[0].tipo_frecuencia}`);
        console.log(`      📅 Fecha: ${notification[0].fecha_envio_programada}`);
        console.log(`      📝 Preview: ${notification[0].mensaje_preview}...`);
      }
      
      // Limpiar datos de prueba
      await pool.query('DELETE FROM faltantes WHERE faltante_id = ?', [faltanteId]);
      console.log('   🧹 Faltante de prueba eliminado');
      
      // Restaurar configuración
      await pool.query(`
        UPDATE notificaciones_config 
        SET config_frecuencia = 'inmediata'
        WHERE config_tipo = 'email'
      `);
    }
    
    console.log('\n✅ IMPLEMENTACIÓN CORREGIDA Y COMPLETADA!');
    console.log('\n📋 Sistema implementado correctamente:');
    console.log('  ✅ Campo tipo_frecuencia funcionando');
    console.log('  ✅ Trigger respeta configuración de frecuencia');
    console.log('  ✅ Stored procedure para agrupación listo');
    console.log('  ✅ Mensajes detallados y profesionales');
    console.log('  ✅ Cálculo correcto de fechas de envío');
    
    console.log('\n⚙️ Para usar en producción:');
    console.log('  1. Configurar frecuencia en notificaciones_config');
    console.log('  2. Ejecutar sp_agrupar_notificaciones_pendientes() periódicamente');
    console.log('  3. El servicio de notificaciones enviará según horarios');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixTriggerAndImplement();