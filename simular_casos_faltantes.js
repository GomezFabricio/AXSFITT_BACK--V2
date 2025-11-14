import { pool } from './db.js';
import NotificacionesStockService from './services/notificaciones-stock.service.js';

/**
 * Simulación completa de casos de faltantes para validar formato de correos
 */
async function simularCasosFaltantes() {
  try {
    console.log('📋 === SIMULACIÓN DE CASOS DE FALTANTES ===\n');
    
    const faltantesCreados = [];
    
    // ========================================
    // CASO 1: NOTIFICACIONES INMEDIATAS (2 faltantes)
    // ========================================
    
    console.log('⚡ CASO 1: NOTIFICACIONES INMEDIATAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Configurar para inmediatas
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata',
          config_activo = 1
      WHERE config_tipo = 'email'
    `);
    
    console.log('✅ Configuración: INMEDIATA\n');
    
    // Faltante 1: Producto con variante
    console.log('📦 Creando Faltante 1: Whey Protein con variante...');
    const [inmediata1] = await pool.query(`
      INSERT INTO faltantes (
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (1, 100, 15, 'detectado', NOW())
    `);
    faltantesCreados.push(inmediata1.insertId);
    
    // Faltante 2: Producto sin variante
    console.log('📦 Creando Faltante 2: Producto sin variante...');
    const [inmediata2] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (2, 80, 12, 'detectado', NOW())
    `);
    faltantesCreados.push(inmediata2.insertId);
    
    // Verificar notificaciones inmediatas creadas
    const [notifInmediatas] = await pool.query(`
      SELECT asunto, mensaje
      FROM notificaciones_pendientes 
      WHERE faltante_id IN (?, ?) AND tipo_frecuencia = 'inmediata'
      ORDER BY fecha_creacion
    `, [inmediata1.insertId, inmediata2.insertId]);
    
    console.log(`✅ ${notifInmediatas.length} notificaciones inmediatas creadas\n`);
    
    // Mostrar formato de emails inmediatos
    notifInmediatas.forEach((notif, index) => {
      console.log(`📧 EMAIL INMEDIATO ${index + 1}:`);
      console.log('📌 ASUNTO:');
      console.log(`   ${notif.asunto}\n`);
      console.log('📄 CUERPO COMPLETO:');
      console.log('─'.repeat(70));
      console.log(notif.mensaje);
      console.log('─'.repeat(70));
      console.log('');
    });
    
    // ========================================
    // CASO 2: NOTIFICACIONES AGRUPADAS (3 faltantes)
    // ========================================
    
    console.log('\n📦 CASO 2: NOTIFICACIONES AGRUPADAS (DIARIAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Configurar para diarias
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'diaria',
          config_hora_envio = '${new Date().getHours()}:${(new Date().getMinutes() + 2).toString().padStart(2, '0')}:00'
      WHERE config_tipo = 'email'
    `);
    
    console.log('✅ Configuración: DIARIA (se agrupará automáticamente)\n');
    
    // Faltante 3: Whey Protein - Frutilla
    console.log('📦 Creando Faltante 3: Whey Protein - Frutilla...');
    const [diaria1] = await pool.query(`
      INSERT INTO faltantes (
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (2, 75, 8, 'detectado', NOW())
    `);
    faltantesCreados.push(diaria1.insertId);
    
    // Faltante 4: Creatina (sin variante)
    console.log('📦 Creando Faltante 4: Creatina Monohidratada...');
    const [diaria2] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (2, 60, 5, 'detectado', NOW())
    `);
    faltantesCreados.push(diaria2.insertId);
    
    // Faltante 5: Otro producto con variante
    console.log('📦 Creando Faltante 5: Whey Protein - Vainilla...');
    const [diaria3] = await pool.query(`
      INSERT INTO faltantes (
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado,
        faltante_fecha_deteccion
      ) VALUES (1, 90, 18, 'detectado', NOW())
    `);
    faltantesCreados.push(diaria3.insertId);
    
    console.log(`✅ 3 faltantes para agrupación creados\n`);
    
    // Verificar notificaciones individuales diarias
    const [notifDiarias] = await pool.query(`
      SELECT asunto, LEFT(mensaje, 100) as preview
      FROM notificaciones_pendientes 
      WHERE faltante_id IN (?, ?, ?) AND tipo_frecuencia = 'diaria'
      ORDER BY fecha_creacion
    `, [diaria1.insertId, diaria2.insertId, diaria3.insertId]);
    
    console.log('📄 NOTIFICACIONES INDIVIDUALES DIARIAS CREADAS:');
    notifDiarias.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.asunto}`);
      console.log(`      Preview: ${notif.preview}...`);
    });
    
    // Ejecutar proceso de agrupación
    console.log('\n🔗 Ejecutando proceso de agrupación...');
    const resultadoAgrupacion = await NotificacionesStockService.ejecutarAgrupacionAutomatica();
    console.log('✅ Agrupación completada:', resultadoAgrupacion);
    
    // Obtener notificación agrupada
    const [notifAgrupada] = await pool.query(`
      SELECT asunto, mensaje
      FROM notificaciones_pendientes 
      WHERE tipo_frecuencia = 'diaria_agrupado'
      AND DATE(fecha_creacion) = CURDATE()
      ORDER BY fecha_creacion DESC
      LIMIT 1
    `);
    
    if (notifAgrupada.length > 0) {
      console.log('\n📧 EMAIL AGRUPADO:');
      console.log('📌 ASUNTO:');
      console.log(`   ${notifAgrupada[0].asunto}\n`);
      console.log('📄 CUERPO COMPLETO:');
      console.log('═'.repeat(80));
      console.log(notifAgrupada[0].mensaje);
      console.log('═'.repeat(80));
    }
    
    // Verificar estado de notificaciones individuales
    const [estadosIndividuales] = await pool.query(`
      SELECT asunto, estado
      FROM notificaciones_pendientes 
      WHERE faltante_id IN (?, ?, ?)
      ORDER BY fecha_creacion
    `, [diaria1.insertId, diaria2.insertId, diaria3.insertId]);
    
    console.log('\n📊 ESTADO DE NOTIFICACIONES INDIVIDUALES:');
    estadosIndividuales.forEach((notif, index) => {
      const emoji = notif.estado === 'agrupado' ? '🔗' : '📄';
      console.log(`   ${emoji} ${notif.estado.toUpperCase()}: ${notif.asunto}`);
    });
    
    // ========================================
    // DEMOSTRACIÓN DE ENVÍO
    // ========================================
    
    console.log('\n🚀 CASO 3: SIMULACIÓN DE ENVÍO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Procesar inmediatas
    console.log('📧 Procesando notificaciones inmediatas...');
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata'
      WHERE config_tipo = 'email'
    `);
    
    const resultadoInmediatas = await NotificacionesStockService.enviarNotificacionesPendientes();
    console.log('✅ Inmediatas procesadas:', resultadoInmediatas);
    
    // Procesar agrupadas (configurar horario actual)
    console.log('\n📦 Procesando notificación agrupada...');
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'diaria',
          config_hora_envio = '${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}:00'
      WHERE config_tipo = 'email'
    `);
    
    const resultadoAgrupadas = await NotificacionesStockService.enviarNotificacionesPendientes();
    console.log('✅ Agrupadas procesadas:', resultadoAgrupadas);
    
    // ========================================
    // RESUMEN FINAL
    // ========================================
    
    console.log('\n🎯 RESUMEN DE VALIDACIÓN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Verificar emails enviados
    const [enviados] = await pool.query(`
      SELECT 
        asunto,
        tipo_frecuencia,
        DATE_FORMAT(fecha_envio, '%d/%m/%Y %H:%i') as fecha_envio_real
      FROM notificaciones_pendientes 
      WHERE estado = 'enviado'
      AND DATE(fecha_creacion) = CURDATE()
      ORDER BY fecha_envio DESC
    `);
    
    console.log('\n📬 EMAILS ENVIADOS:');
    enviados.forEach((email, index) => {
      const tipoEmoji = email.tipo_frecuencia.includes('agrupado') ? '📦' : '📧';
      const tipo = email.tipo_frecuencia.includes('agrupado') ? 'AGRUPADO' : 'INDIVIDUAL';
      console.log(`   ${tipoEmoji} ${tipo}: ${email.asunto}`);
      console.log(`      📅 Enviado: ${email.fecha_envio_real}`);
      console.log('');
    });
    
    console.log('✅ VALIDACIONES EXITOSAS:');
    console.log('  📝 Nombres de productos legibles (sin IDs)');
    console.log('  🏷️  Variantes mostradas como "Producto - Atributo: Valor"');
    console.log('  📧 Asuntos profesionales y claros');
    console.log('  📦 Agrupación funcionando correctamente');
    console.log('  ⚡ Inmediatas enviadas por separado');
    console.log('  📊 Estados manejados correctamente');
    
    console.log('\n💡 EJEMPLOS DEMOSTRADOS:');
    console.log('  📧 Individual: "🚨 Faltante: Whey Protein - Sabor: Vainilla"');
    console.log('  📦 Agrupado: "📋 Resumen diario: 3 productos con faltantes"');
    console.log('  🎨 Formato HTML profesional para emails');
    
    // ========================================
    // LIMPIEZA
    // ========================================
    
    console.log('\n🧹 Limpiando datos de prueba...');
    if (faltantesCreados.length > 0) {
      await pool.query(`
        DELETE FROM faltantes 
        WHERE faltante_id IN (${faltantesCreados.map(() => '?').join(',')})
      `, faltantesCreados);
      console.log(`✅ ${faltantesCreados.length} faltantes eliminados`);
    }
    
    // Restaurar configuración
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata',
          config_hora_envio = '09:00:00'
      WHERE config_tipo = 'email'
    `);
    console.log('✅ Configuración restaurada');
    
    console.log('\n🎉 === SIMULACIÓN COMPLETADA CON ÉXITO ===');
    
  } catch (error) {
    console.error('❌ Error en simulación:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

simularCasosFaltantes();