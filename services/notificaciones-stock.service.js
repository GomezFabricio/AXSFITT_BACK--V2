import { pool } from '../db.js';
import transporter from '../emailConfig.js';

/**
 * Servicio simplificado para manejar notificaciones de stock
 * Trabaja directamente con la nueva estructura de BD
 */
export class NotificacionesStockService {
  
  /**
   * Envía las notificaciones pendientes de email
   */
  static async enviarNotificacionesPendientes() {
    try {
      console.log('\n📧 === SERVICIO DE NOTIFICACIONES DE STOCK ===');
      
      // Obtener notificaciones pendientes QUE CORRESPONDAN A LA FECHA DEL DÍA
      const [pendientes] = await pool.query(`
        SELECT 
          np.id,
          np.destinatario_email,
          np.destinatario_nombre,
          np.asunto,
          np.mensaje,
          np.faltante_id,
          DATE_FORMAT(np.fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion,
          DATE_FORMAT(np.fecha_envio_programada, '%d/%m/%Y') as fecha_programada,
          
          -- Información del faltante relacionado
          f.faltante_estado,
          f.faltante_cantidad_faltante
          
        FROM notificaciones_pendientes np
        LEFT JOIN faltantes f ON np.faltante_id = f.faltante_id
        WHERE np.estado = 'pendiente' 
        AND np.tipo_notificacion = 'email'
        AND np.destinatario_email IS NOT NULL
        AND (
          np.fecha_envio_programada IS NULL OR 
          np.fecha_envio_programada <= CURDATE()
        )
        ORDER BY np.fecha_creacion ASC
        LIMIT 10
      `);
      
      if (pendientes.length === 0) {
        console.log('✅ No hay notificaciones pendientes para enviar hoy');
        console.log(`📅 Fecha actual: ${new Date().toLocaleDateString()}`);
        return { enviadas: 0, errores: 0 };
      }
      
      console.log(`📨 Notificaciones pendientes para hoy: ${pendientes.length}`);
      console.log(`📅 Fecha de procesamiento: ${new Date().toLocaleDateString()}`);
      
      // Log detallado de cada notificación
      pendientes.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.asunto} - Programada: ${notif.fecha_programada || 'Inmediata'}`);
      });
      
      let enviadas = 0;
      let errores = 0;
      
      // Verificar configuración de email
      const emailConfigurado = await this.verificarConfiguracionEmail();
      
      for (const notif of pendientes) {
        try {
          
          if (emailConfigurado) {
            // Envío real
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'sistema@axsfitt.com',
              to: notif.destinatario_email,
              subject: notif.asunto,
              text: notif.mensaje,
              html: notif.mensaje.replace(/\n/g, '<br>')
            });
            console.log(`✅ Email enviado: ${notif.destinatario_email}`);
          } else {
            // Simulación
            console.log(`📧 SIMULACIÓN - Email: ${notif.destinatario_email}`);
            console.log(`   Asunto: ${notif.asunto}`);
          }
          
          // Marcar como enviado
          await pool.query(`
            UPDATE notificaciones_pendientes 
            SET estado = 'enviado', fecha_envio = NOW() 
            WHERE id = ?
          `, [notif.id]);
          
          enviadas++;
          
        } catch (error) {
          console.error(`❌ Error enviando a ${notif.destinatario_email}:`, error.message);
          
          // Marcar como error
          await pool.query(`
            UPDATE notificaciones_pendientes 
            SET estado = 'error', error_mensaje = ?
            WHERE id = ?
          `, [error.message, notif.id]);
          
          errores++;
        }
      }
      
      console.log(`\n📊 Resumen: ${enviadas} enviadas, ${errores} errores`);
      return { enviadas, errores, total: pendientes.length };
      
    } catch (error) {
      console.error('❌ Error en servicio de notificaciones:', error);
      return { enviadas: 0, errores: 1, total: 0 };
    }
  }
  
  /**
   * Obtiene estadísticas de notificaciones
   */
  static async obtenerEstadisticas() {
    try {
      const [stats] = await pool.query(`
        SELECT 
          estado,
          COUNT(*) as cantidad,
          DATE(fecha_creacion) as fecha
        FROM notificaciones_pendientes 
        GROUP BY estado, DATE(fecha_creacion)
        ORDER BY fecha DESC, estado
      `);
      
      const [resumen] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as enviadas,
          SUM(CASE WHEN estado = 'error' THEN 1 ELSE 0 END) as errores
        FROM notificaciones_pendientes
      `);
      
      return {
        resumen: resumen[0],
        detalles: stats
      };
      
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { resumen: {}, detalles: [] };
    }
  }
  
  /**
   * Verifica si el email está configurado
   */
  static async verificarConfiguracionEmail() {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return false;
      }
      
      await transporter.verify();
      return true;
    } catch (error) {
      console.log('⚠️ Email no configurado, modo simulación');
      return false;
    }
  }
  
  /**
   * Fuerza el procesamiento de notificaciones (llamada manual)
   */
  static async procesarNotificaciones() {
    console.log('\n🚀 === PROCESAMIENTO MANUAL DE NOTIFICACIONES ===');
    
    // Mostrar estadísticas actuales
    const stats = await this.obtenerEstadisticas();
    console.log('📊 Estado actual:', stats.resumen);
    
    // Enviar pendientes
    const resultado = await this.enviarNotificacionesPendientes();
    
    return {
      estadisticas_previas: stats,
      resultado_envio: resultado
    };
  }
}

export default NotificacionesStockService;