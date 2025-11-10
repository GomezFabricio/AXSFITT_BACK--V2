import { pool } from './db.js';

/**
 * Script para crear una notificación de prueba y verificar 
 * que el sistema automático la detecte y procese
 */

async function testAutoNotifications() {
  try {
    console.log('🧪 === TEST DE NOTIFICACIONES AUTOMÁTICAS ===\n');
    
    // 1. Crear una notificación pendiente de prueba
    console.log('📝 Creando notificación de prueba...');
    const [result] = await pool.query(`
      INSERT INTO notificaciones_pendientes (
        tipo_notificacion,
        destinatario_email,
        asunto,
        mensaje,
        estado,
        fecha_creacion
      ) VALUES (
        'email',
        'fabricio.gomez4371@gmail.com',
        '🧪 TEST: Notificación automática',
        'Esta es una notificación de prueba para verificar el sistema automático.\\n\\nSi recibiste este email, significa que el sistema está funcionando correctamente.\\n\\nFecha de prueba: ${new Date().toLocaleString()}',
        'pendiente',
        NOW()
      )
    `);
    
    const notifId = result.insertId;
    console.log(`✅ Notificación de prueba creada con ID: ${notifId}`);
    
    // 2. Verificar que existe en pendientes
    const [pendientes] = await pool.query(`
      SELECT COUNT(*) as cantidad 
      FROM notificaciones_pendientes 
      WHERE estado = 'pendiente'
    `);
    
    console.log(`📊 Notificaciones pendientes totales: ${pendientes[0].cantidad}`);
    
    // 3. Mostrar información del servidor
    console.log('\n📡 INFORMACIÓN PARA TESTING:');
    console.log('- El servidor debe estar ejecutándose con: nodemon index.js');
    console.log('- El procesamiento automático ocurre cada 5 minutos');
    console.log('- También al iniciar el servidor (después de 5 segundos)');
    console.log('- Revisa los logs del servidor para ver el procesamiento');
    
    console.log('\n⏰ PRÓXIMOS PASOS:');
    console.log('1. Reinicia el servidor para que procese la notificación al inicio');
    console.log('2. O espera hasta 5 minutos para el procesamiento automático');
    console.log('3. Revisa los logs del servidor para confirmar el envío');
    
    console.log('\n🔍 Para verificar el estado después:');
    console.log(`   SELECT * FROM notificaciones_pendientes WHERE id = ${notifId};`);
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar el test
testAutoNotifications();