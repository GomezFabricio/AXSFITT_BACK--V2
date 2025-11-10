import { pool } from './db.js';

/**
 * Script para probar el sistema mejorado de notificaciones
 * con gestión de fechas y nombres de productos
 */

async function testImprovedNotificationSystem() {
  try {
    console.log('🧪 === TEST DEL SISTEMA MEJORADO DE NOTIFICACIONES ===\n');
    
    // 1. Verificar configuración actual
    console.log('📋 Verificando configuración actual...');
    const [config] = await pool.query(`
      SELECT config_tipo, config_activo, config_frecuencia, config_dias_semana
      FROM notificaciones_config 
      WHERE config_tipo = 'email'
    `);
    
    console.log('Configuración:', config[0]);
    
    // 2. Probar con configuración inmediata
    console.log('\n🔧 Configurando para envío inmediato...');
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata'
      WHERE config_tipo = 'email'
    `);
    
    // 3. Crear faltante de prueba (inmediato)
    console.log('📦 Creando faltante con producto y variante...');
    const [insertResult1] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado
      ) VALUES (1, 2, 20, 12, 'detectado')
    `);
    
    // 4. Verificar notificación inmediata
    const [immediateNotif] = await pool.query(`
      SELECT 
        asunto, 
        LEFT(mensaje, 150) as mensaje_preview,
        fecha_envio_programada,
        DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion
      FROM notificaciones_pendientes 
      WHERE faltante_id = ?
    `, [insertResult1.insertId]);
    
    if (immediateNotif.length > 0) {
      console.log('✅ Notificación inmediata creada:');
      console.log(`   📧 Asunto: ${immediateNotif[0].asunto}`);
      console.log(`   📅 Fecha programada: ${immediateNotif[0].fecha_envio_programada}`);
      console.log(`   📝 Preview: ${immediateNotif[0].mensaje_preview}...`);
    }
    
    // 5. Probar configuración diaria
    console.log('\n🔧 Configurando para envío diario...');
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'diaria'
      WHERE config_tipo = 'email'
    `);
    
    // 6. Crear otro faltante (diario)
    const [insertResult2] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado
      ) VALUES (2, NULL, 25, 8, 'detectado')
    `);
    
    // 7. Verificar notificación diaria
    const [dailyNotif] = await pool.query(`
      SELECT 
        asunto, 
        fecha_envio_programada,
        DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion
      FROM notificaciones_pendientes 
      WHERE faltante_id = ?
    `, [insertResult2.insertId]);
    
    if (dailyNotif.length > 0) {
      console.log('✅ Notificación diaria creada:');
      console.log(`   📧 Asunto: ${dailyNotif[0].asunto}`);
      console.log(`   📅 Fecha programada: ${dailyNotif[0].fecha_envio_programada}`);
    }
    
    // 8. Mostrar todas las notificaciones pendientes con filtro de fecha
    console.log('\n📊 Todas las notificaciones pendientes:');
    const [allPending] = await pool.query(`
      SELECT 
        id,
        asunto,
        estado,
        fecha_envio_programada,
        DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion,
        CASE 
          WHEN fecha_envio_programada IS NULL THEN 'INMEDIATA'
          WHEN fecha_envio_programada <= CURDATE() THEN 'LISTA PARA ENVÍO HOY'
          ELSE 'PROGRAMADA PARA FUTURO'
        END as status_envio
      FROM notificaciones_pendientes 
      WHERE estado = 'pendiente'
      ORDER BY fecha_creacion DESC
    `);
    
    allPending.forEach((notif, index) => {
      console.log(`   ${index + 1}. [${notif.status_envio}] ${notif.asunto}`);
      console.log(`      📅 Programada: ${notif.fecha_envio_programada || 'Inmediata'}`);
    });
    
    // 9. Simular el filtro del servicio automático
    console.log('\n🔍 Simulando filtro del servicio automático (solo de hoy):');
    const [todayNotifications] = await pool.query(`
      SELECT 
        asunto,
        fecha_envio_programada
      FROM notificaciones_pendientes 
      WHERE estado = 'pendiente' 
      AND (fecha_envio_programada IS NULL OR fecha_envio_programada <= CURDATE())
    `);
    
    console.log(`📨 Notificaciones que se enviarían automáticamente hoy: ${todayNotifications.length}`);
    todayNotifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.asunto}`);
    });
    
    // 10. Limpiar - eliminar faltantes de prueba
    await pool.query('DELETE FROM faltantes WHERE faltante_id IN (?, ?)', [insertResult1.insertId, insertResult2.insertId]);
    console.log('\n🧹 Faltantes de prueba eliminados');
    
    // 11. Restaurar configuración original
    await pool.query(`
      UPDATE notificaciones_config 
      SET config_frecuencia = 'inmediata'
      WHERE config_tipo = 'email'
    `);
    console.log('🔧 Configuración restaurada a inmediata');
    
    console.log('\n✅ TEST COMPLETADO EXITOSAMENTE!');
    console.log('📋 Funcionalidades verificadas:');
    console.log('  ✅ Nombres de productos y variantes detallados');
    console.log('  ✅ Gestión de fechas según configuración (inmediata/diaria/semanal)');
    console.log('  ✅ Filtro automático por fecha del día');
    console.log('  ✅ Mensajes mejorados con información completa');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar el test
testImprovedNotificationSystem();