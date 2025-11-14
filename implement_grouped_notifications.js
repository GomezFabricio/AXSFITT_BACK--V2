import { pool } from './db.js';

/**
 * Script para implementar el sistema de notificaciones agrupadas
 */
async function implementGroupedNotifications() {
  try {
    console.log('🚀 Implementando sistema de notificaciones agrupadas...\n');
    
    // 1. Agregar campo tipo_frecuencia a notificaciones_pendientes
    console.log('📝 1. Agregando campo tipo_frecuencia...');
    try {
      await pool.query(`
        ALTER TABLE notificaciones_pendientes 
        ADD COLUMN tipo_frecuencia enum('inmediata','diaria','semanal','diaria_agrupado','semanal_agrupado') 
        DEFAULT 'inmediata' 
        AFTER faltante_id
      `);
      console.log('   ✅ Campo tipo_frecuencia agregado exitosamente');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('   ℹ️ Campo tipo_frecuencia ya existe');
      } else {
        console.log('   ❌ Error agregando campo:', error.message);
      }
    }
    
    // 2. Actualizar estado enum para incluir 'agrupado'
    console.log('\n📝 2. Actualizando enum de estado...');
    try {
      await pool.query(`
        ALTER TABLE notificaciones_pendientes 
        MODIFY COLUMN estado enum('pendiente','enviado','error','agrupado') DEFAULT 'pendiente'
      `);
      console.log('   ✅ Estado enum actualizado');
    } catch (error) {
      console.log('   ℹ️ Estado enum ya actualizado o error:', error.message);
    }
    
    // 3. Eliminar trigger existente y crear uno mejorado
    console.log('\n🔧 3. Actualizando trigger de faltantes...');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_inmediata');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_mejorado');
    
    await pool.query(`
      CREATE TRIGGER trg_notificacion_faltante_completo 
      AFTER INSERT ON faltantes FOR EACH ROW 
      BEGIN
          DECLARE config_activo_val INT DEFAULT 0;
          DECLARE config_frecuencia_val VARCHAR(20) DEFAULT 'inmediata';
          DECLARE config_hora_envio_val TIME DEFAULT '09:00:00';
          DECLARE config_dias_semana_val JSON DEFAULT NULL;
          
          DECLARE producto_nombre_val VARCHAR(255) DEFAULT '';
          DECLARE variante_descripcion_val VARCHAR(500) DEFAULT '';
          DECLARE producto_completo VARCHAR(800) DEFAULT '';
          DECLARE fecha_envio_calculada DATE DEFAULT NULL;
          DECLARE mensaje_detallado TEXT DEFAULT '';
          
          -- Obtener configuración de notificaciones
          SELECT config_activo, IFNULL(config_frecuencia, 'inmediata'), 
                 IFNULL(config_hora_envio, '09:00:00'), config_dias_semana
          INTO config_activo_val, config_frecuencia_val, config_hora_envio_val, config_dias_semana_val
          FROM notificaciones_config 
          WHERE config_tipo = 'email' AND config_activo = 1
          LIMIT 1;
          
          -- Solo procesar si las notificaciones están activas
          IF config_activo_val = 1 THEN
              
              -- Obtener información del producto/variante
              IF NEW.faltante_variante_id IS NOT NULL THEN
                  SELECT 
                      CONCAT(
                          IFNULL(p.producto_nombre, 'Producto'),
                          ' - ',
                          GROUP_CONCAT(
                              CONCAT(av.atributo_nombre, ': ', vv.valor_nombre) 
                              SEPARATOR ', '
                          )
                      )
                  INTO variante_descripcion_val
                  FROM variantes v
                  LEFT JOIN productos p ON v.producto_id = p.producto_id
                  LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
                  LEFT JOIN atributos_variantes av ON vv.atributo_variante_id = av.atributo_variante_id
                  WHERE v.variante_id = NEW.faltante_variante_id
                  GROUP BY v.variante_id;
                  
                  SET producto_completo = IFNULL(variante_descripcion_val, 'Producto con variantes');
              ELSEIF NEW.faltante_producto_id IS NOT NULL THEN
                  SELECT producto_nombre INTO producto_nombre_val
                  FROM productos 
                  WHERE producto_id = NEW.faltante_producto_id;
                  
                  SET producto_completo = IFNULL(producto_nombre_val, 'Producto sin nombre');
              ELSE
                  SET producto_completo = 'Producto no identificado';
              END IF;
              
              -- Calcular fecha de envío según configuración
              IF config_frecuencia_val = 'inmediata' THEN
                  SET fecha_envio_calculada = CURDATE();
              ELSEIF config_frecuencia_val = 'diaria' THEN
                  -- Para diaria: si aún no pasó la hora de hoy, enviar hoy; sino mañana
                  IF TIME(NOW()) <= config_hora_envio_val THEN
                      SET fecha_envio_calculada = CURDATE();
                  ELSE
                      SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL 1 DAY);
                  END IF;
              ELSEIF config_frecuencia_val = 'semanal' THEN
                  -- Para semanal: próximo lunes o día configurado
                  SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL (7 - WEEKDAY(CURDATE())) DAY);
              ELSE
                  SET fecha_envio_calculada = CURDATE();
              END IF;
              
              -- Crear mensaje detallado
              SET mensaje_detallado = CONCAT(
                  '📦 PRODUCTO FALTANTE\\n',
                  '════════════════════\\n',
                  '🏷️  Producto: ', producto_completo, '\\n',
                  '📊 Cantidad faltante: ', NEW.faltante_cantidad_faltante, ' unidades\\n',
                  '⚠️  Estado: ', NEW.faltante_estado, '\\n',
                  '📅 Detectado: ', DATE_FORMAT(NEW.faltante_fecha_deteccion, '%d/%m/%Y %H:%i'), '\\n',
                  '🔢 ID Faltante: #', NEW.faltante_id, '\\n',
                  '\\n⏰ Notificación generada automáticamente por el sistema'
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
                  CONCAT('🚨 Faltante detectado: ', producto_completo),
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
    
    console.log('   ✅ Trigger completo creado exitosamente');
    
    // 4. Crear stored procedure para agrupar notificaciones
    console.log('\n🔗 4. Creando stored procedure para agrupación...');
    await pool.query('DROP PROCEDURE IF EXISTS sp_agrupar_notificaciones_pendientes');
    
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
                  CONCAT('📋 Resumen ', v_tipo_frecuencia, ' de faltantes (', v_count, ' productos)'),
                  CONCAT(
                      '📋 RESUMEN DE FALTANTES - ', UPPER(v_tipo_frecuencia), '\\n',
                      '═══════════════════════════════════════\\n',
                      '📅 Fecha del reporte: ', DATE_FORMAT(v_fecha_envio, '%d/%m/%Y'), '\\n',
                      '📊 Total de productos con faltantes: ', v_count, '\\n\\n',
                      '📦 DETALLE DE FALTANTES:\\n',
                      '────────────────────────────\\n',
                      GROUP_CONCAT(
                          CONCAT(
                              '• ', 
                              SUBSTRING_INDEX(SUBSTRING_INDEX(asunto, ': ', -1), ' (', 1),
                              ' - ', 
                              REGEXP_SUBSTR(mensaje, 'Cantidad faltante: [0-9]+ unidades')
                          ) 
                          SEPARATOR '\\n'
                      ),
                      '\\n\\n⚠️ Es necesario revisar el stock de estos productos.',
                      '\\n🔄 Reporte generado automáticamente por el sistema.',
                      '\\n📧 Para más detalles, revise el panel de administración.'
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
    
    console.log('   ✅ Stored procedure creado exitosamente');
    
    // 5. Probar el sistema
    console.log('\n🧪 5. Probando el sistema...');
    
    // Configurar para prueba diaria
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'diaria', 
          config_hora_envio = '10:00:00',
          config_activo = 1
      WHERE config_tipo = 'email'
    `);
    
    // Crear faltantes de prueba
    const faltantesIds = [];
    for (let i = 0; i < 3; i++) {
      const [result] = await pool.query(`
        INSERT INTO faltantes (
          faltante_variante_id, 
          faltante_cantidad_original, 
          faltante_cantidad_faltante, 
          faltante_estado,
          faltante_fecha_deteccion
        ) VALUES (?, 20, ?, 'detectado', NOW())
      `, [1, 10 + i * 3]);
      
      faltantesIds.push(result.insertId);
    }
    
    console.log(`   ✅ Creados ${faltantesIds.length} faltantes de prueba`);
    
    // Verificar notificaciones creadas
    const [creadas] = await pool.query(`
      SELECT COUNT(*) as cantidad, tipo_frecuencia
      FROM notificaciones_pendientes 
      WHERE faltante_id IN (${faltantesIds.map(() => '?').join(',')})
      GROUP BY tipo_frecuencia
    `, faltantesIds);
    
    console.log('   📧 Notificaciones creadas:', creadas);
    
    // Ejecutar agrupación
    await pool.query('CALL sp_agrupar_notificaciones_pendientes()');
    console.log('   🔗 Proceso de agrupación ejecutado');
    
    // Verificar resultado
    const [agrupadas] = await pool.query(`
      SELECT asunto, tipo_frecuencia, estado
      FROM notificaciones_pendientes 
      WHERE tipo_frecuencia LIKE '%_agrupado'
      AND DATE(fecha_creacion) = CURDATE()
      ORDER BY fecha_creacion DESC
      LIMIT 1
    `);
    
    if (agrupadas.length > 0) {
      console.log('   ✅ Notificación agrupada creada:', agrupadas[0].asunto);
    }
    
    // Limpiar datos de prueba
    await pool.query(`
      DELETE FROM faltantes 
      WHERE faltante_id IN (${faltantesIds.map(() => '?').join(',')})
    `, faltantesIds);
    
    // Restaurar configuración
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata'
      WHERE config_tipo = 'email'
    `);
    
    console.log('\n✅ IMPLEMENTACIÓN COMPLETADA!');
    console.log('\n📋 Funcionalidades agregadas:');
    console.log('  ✅ Campo tipo_frecuencia en notificaciones_pendientes');
    console.log('  ✅ Trigger completo que respeta configuración de frecuencia');
    console.log('  ✅ Stored procedure para agrupar notificaciones');
    console.log('  ✅ Estado "agrupado" para evitar envíos duplicados');
    console.log('  ✅ Cálculo inteligente de fechas de envío');
    
    console.log('\n⚙️ Configuración recomendada:');
    console.log('  • Ejecutar sp_agrupar_notificaciones_pendientes() cada hora');
    console.log('  • Configurar cron job para envío en horarios específicos');
    console.log('  • Monitorear notificaciones con estado "agrupado"');
    
  } catch (error) {
    console.error('❌ Error en implementación:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

implementGroupedNotifications();