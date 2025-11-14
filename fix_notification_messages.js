import { pool } from './db.js';

/**
 * Script para corregir la generación de nombres legibles en notificaciones
 */
async function fixNotificationMessages() {
  try {
    console.log('🔧 Corrigiendo generación de nombres legibles en notificaciones...\n');
    
    // 1. Recrear trigger con lógica mejorada para nombres
    console.log('📝 Recreando trigger con nombres legibles...');
    await pool.query('DROP TRIGGER IF EXISTS trg_notificacion_faltante_completo');
    
    await pool.query(`
      CREATE TRIGGER trg_notificacion_faltante_completo 
      AFTER INSERT ON faltantes FOR EACH ROW 
      BEGIN
          DECLARE config_activo_val INT DEFAULT 0;
          DECLARE config_frecuencia_val VARCHAR(20) DEFAULT 'inmediata';
          DECLARE config_hora_envio_val TIME DEFAULT '09:00:00';
          
          DECLARE producto_nombre_completo VARCHAR(800) DEFAULT '';
          DECLARE fecha_envio_calculada DATE DEFAULT NULL;
          DECLARE mensaje_detallado TEXT DEFAULT '';
          DECLARE asunto_legible VARCHAR(255) DEFAULT '';
          
          -- Obtener configuración de notificaciones
          SELECT config_activo, IFNULL(config_frecuencia, 'inmediata'), 
                 IFNULL(config_hora_envio, '09:00:00')
          INTO config_activo_val, config_frecuencia_val, config_hora_envio_val
          FROM notificaciones_config 
          WHERE config_tipo = 'email' AND config_activo = 1
          LIMIT 1;
          
          -- Solo procesar si las notificaciones están activas
          IF config_activo_val = 1 THEN
              
              -- OBTENER NOMBRE COMPLETO DEL PRODUCTO CON VARIANTE
              IF NEW.faltante_variante_id IS NOT NULL THEN
                  -- Producto con variante: "Whey Protein - Sabor: Vainilla"
                  SELECT 
                      CONCAT(
                          TRIM(p.producto_nombre),
                          ' - ',
                          GROUP_CONCAT(
                              CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) 
                              SEPARATOR ', '
                          )
                      )
                  INTO producto_nombre_completo
                  FROM variantes v
                  LEFT JOIN productos p ON v.producto_id = p.producto_id
                  LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
                  LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
                  WHERE v.variante_id = NEW.faltante_variante_id
                  GROUP BY v.variante_id;
                  
              ELSEIF NEW.faltante_producto_id IS NOT NULL THEN
                  -- Producto sin variante: solo nombre del producto
                  SELECT TRIM(producto_nombre) 
                  INTO producto_nombre_completo
                  FROM productos 
                  WHERE producto_id = NEW.faltante_producto_id;
              END IF;
              
              -- Si no se pudo obtener nombre, usar descripción genérica
              IF producto_nombre_completo IS NULL OR producto_nombre_completo = '' THEN
                  SET producto_nombre_completo = 'Producto no identificado';
              END IF;
              
              -- Calcular fecha de envío según configuración
              CASE config_frecuencia_val
                  WHEN 'inmediata' THEN
                      SET fecha_envio_calculada = CURDATE();
                  WHEN 'diaria' THEN
                      IF TIME(NOW()) <= config_hora_envio_val THEN
                          SET fecha_envio_calculada = CURDATE();
                      ELSE
                          SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL 1 DAY);
                      END IF;
                  WHEN 'semanal' THEN
                      SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL (7 - WEEKDAY(CURDATE())) DAY);
                  ELSE
                      SET fecha_envio_calculada = CURDATE();
              END CASE;
              
              -- Crear asunto legible sin IDs
              SET asunto_legible = CONCAT('🚨 Faltante: ', producto_nombre_completo);
              
              -- Crear mensaje detallado legible
              SET mensaje_detallado = CONCAT(
                  '🚨 ALERTA DE STOCK\\n',
                  '════════════════════════════════════════\\n\\n',
                  '📦 PRODUCTO AFECTADO:\\n',
                  '   ', producto_nombre_completo, '\\n\\n',
                  '📊 INFORMACIÓN DEL FALTANTE:\\n',
                  '   • Cantidad faltante: ', NEW.faltante_cantidad_faltante, ' unidades\\n',
                  '   • Cantidad original: ', NEW.faltante_cantidad_original, ' unidades\\n',
                  '   • Estado: ', UPPER(NEW.faltante_estado), '\\n',
                  '   • Detectado: ', DATE_FORMAT(NEW.faltante_fecha_deteccion, '%d/%m/%Y a las %H:%i'), '\\n\\n',
                  '⚠️ IMPACTO:\\n',
                  '   El stock de este producto ha disminuido por debajo del nivel esperado.\\n',
                  '   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\\n\\n',
                  '📋 ACCIONES RECOMENDADAS:\\n',
                  '   • Verificar stock físico del producto\\n',
                  '   • Revisar pedidos pendientes\\n',
                  '   • Contactar al proveedor si es necesario\\n',
                  '   • Actualizar niveles de stock mínimo\\n\\n',
                  '═══════════════════════════════════════\\n',
                  '⏰ Notificación generada automáticamente por el sistema AXSFITT\\n',
                  '📞 Para consultas, contacte al administrador del sistema.'
              );
              
              -- Insertar notificación con nombres legibles
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
                  asunto_legible,
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
    
    console.log('   ✅ Trigger con nombres legibles creado');
    
    // 2. Actualizar stored procedure para mensajes agrupados legibles
    console.log('\n📦 Actualizando stored procedure para mensajes agrupados...');
    await pool.query('DROP PROCEDURE IF EXISTS sp_agrupar_notificaciones_pendientes');
    
    await pool.query(`
      CREATE PROCEDURE sp_agrupar_notificaciones_pendientes()
      BEGIN
          DECLARE done INT DEFAULT FALSE;
          DECLARE v_fecha_envio DATE;
          DECLARE v_tipo_frecuencia VARCHAR(20);
          DECLARE v_count INT;
          
          DECLARE cur_grupos CURSOR FOR
              SELECT fecha_envio_programada, tipo_frecuencia, COUNT(*) as cantidad
              FROM notificaciones_pendientes 
              WHERE estado = 'pendiente' 
              AND tipo_frecuencia IN ('diaria', 'semanal')
              AND fecha_envio_programada <= CURDATE()
              GROUP BY fecha_envio_programada, tipo_frecuencia
              HAVING COUNT(*) > 1;
              
          DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
          
          OPEN cur_grupos;
          
          read_loop: LOOP
              FETCH cur_grupos INTO v_fecha_envio, v_tipo_frecuencia, v_count;
              IF done THEN
                  LEAVE read_loop;
              END IF;
              
              -- Crear notificación agrupada con formato legible
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
                  CONCAT('📋 Resumen ', v_tipo_frecuencia, ': ', v_count, ' productos con faltantes'),
                  CONCAT(
                      '📋 RESUMEN ', UPPER(v_tipo_frecuencia), ' DE FALTANTES\\n',
                      '═════════════════════════════════════════════════════════\\n\\n',
                      '📅 Fecha del reporte: ', DATE_FORMAT(v_fecha_envio, '%d de %M de %Y'), '\\n',
                      '📊 Total de productos afectados: ', v_count, '\\n\\n',
                      '📦 PRODUCTOS CON FALTANTES:\\n',
                      '─────────────────────────────────────────────────\\n',
                      GROUP_CONCAT(
                          CONCAT(
                              '• ', 
                              -- Extraer solo el nombre del producto del asunto (sin el emoji y "Faltante:")
                              TRIM(SUBSTRING_INDEX(asunto, 'Faltante: ', -1)),
                              '\\n   Cantidad faltante: ', 
                              -- Extraer cantidad del mensaje
                              TRIM(SUBSTRING_INDEX(
                                  SUBSTRING_INDEX(mensaje, 'Cantidad faltante: ', -1),
                                  ' unidades', 1
                              )), ' unidades'
                          ) 
                          SEPARATOR '\\n\\n'
                      ),
                      '\\n\\n🔔 RESUMEN EJECUTIVO:\\n',
                      '─────────────────────────────────────────────\\n',
                      '⚠️ Se detectaron múltiples faltantes en el inventario durante el período.\\n',
                      '📈 Es recomendable revisar los niveles de stock de estos productos.\\n',
                      '🔄 Considere contactar a los proveedores correspondientes.\\n',
                      '📊 Revise el panel de administración para detalles específicos.\\n\\n',
                      '═════════════════════════════════════════════════════════\\n',
                      '⏰ Reporte generado automáticamente el ', DATE_FORMAT(NOW(), '%d/%m/%Y a las %H:%i'), '\\n',
                      '🏢 Sistema de gestión AXSFITT'
                  ),
                  CONCAT(v_tipo_frecuencia, '_agrupado'),
                  v_fecha_envio,
                  'pendiente',
                  NOW()
              FROM notificaciones_pendientes 
              WHERE estado = 'pendiente' 
              AND tipo_frecuencia = v_tipo_frecuencia
              AND fecha_envio_programada = v_fecha_envio;
              
              -- Marcar individuales como agrupadas
              UPDATE notificaciones_pendientes 
              SET estado = 'agrupado'
              WHERE estado = 'pendiente' 
              AND tipo_frecuencia = v_tipo_frecuencia
              AND fecha_envio_programada = v_fecha_envio;
              
          END LOOP;
          
          CLOSE cur_grupos;
      END
    `);
    
    console.log('   ✅ Stored procedure con mensajes legibles actualizado');
    
    // 3. Probar con datos reales
    console.log('\n🧪 Probando con datos reales...');
    
    // Configurar para inmediata para test rápido
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata',
          config_activo = 1
      WHERE config_tipo = 'email'
    `);
    
    // Crear faltante con variante para probar nombres
    const [result] = await pool.query(`
      INSERT INTO faltantes (
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (1, 25, 5, 'detectado', NOW())
    `);
    
    const faltanteId = result.insertId;
    console.log(`   ✅ Faltante de prueba creado con ID: ${faltanteId}`);
    
    // Verificar notificación generada
    const [notification] = await pool.query(`
      SELECT asunto, LEFT(mensaje, 200) as mensaje_preview
      FROM notificaciones_pendientes 
      WHERE faltante_id = ?
    `, [faltanteId]);
    
    if (notification.length > 0) {
      console.log('   ✅ Notificación generada:');
      console.log(`      📧 Asunto: ${notification[0].asunto}`);
      console.log(`      📝 Preview: ${notification[0].mensaje_preview}...`);
    }
    
    // Probar con producto sin variante
    const [result2] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (1, 20, 3, 'detectado', NOW())
    `);
    
    const faltanteId2 = result2.insertId;
    console.log(`   ✅ Faltante sin variante creado con ID: ${faltanteId2}`);
    
    // Verificar notificación sin variante
    const [notification2] = await pool.query(`
      SELECT asunto, LEFT(mensaje, 150) as mensaje_preview
      FROM notificaciones_pendientes 
      WHERE faltante_id = ?
    `, [faltanteId2]);
    
    if (notification2.length > 0) {
      console.log('   ✅ Notificación sin variante:');
      console.log(`      📧 Asunto: ${notification2[0].asunto}`);
      console.log(`      📝 Preview: ${notification2[0].mensaje_preview}...`);
    }
    
    // Limpiar datos de prueba
    await pool.query('DELETE FROM faltantes WHERE faltante_id IN (?, ?)', [faltanteId, faltanteId2]);
    console.log('   🧹 Datos de prueba limpiados');
    
    console.log('\n✅ CORRECCIÓN COMPLETADA!');
    console.log('\n📋 Mejoras implementadas:');
    console.log('  ✅ Nombres de productos legibles (sin IDs)');
    console.log('  ✅ Variantes mostradas como "Producto - Atributo: Valor"');
    console.log('  ✅ Asuntos limpios y profesionales');
    console.log('  ✅ Mensajes agrupados con formato mejorado');
    console.log('  ✅ Información técnica removida del contenido visible');
    
    console.log('\n💡 Ejemplos de formato:');
    console.log('  📧 "🚨 Faltante: Whey Protein - Sabor: Vainilla"');
    console.log('  📧 "🚨 Faltante: Creatina Monohidratada"');
    console.log('  📦 "📋 Resumen diario: 3 productos con faltantes"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixNotificationMessages();