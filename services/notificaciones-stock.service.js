import { pool } from '../db.js';
import transporter from '../emailConfig.js';

/**
 * Servicio simplificado para manejar notificaciones de stock
 * Trabaja directamente con la nueva estructura de BD
 */
export class NotificacionesStockService {
  
  /**
   * Procesa y envía notificaciones con agrupación automática
   */
  static async enviarNotificacionesPendientes() {
    try {
      console.log('\n📧 === SERVICIO DE NOTIFICACIONES DE STOCK MEJORADO ===');
      
      // 1. Primero ejecutar proceso de agrupación
      await this.ejecutarAgrupacionAutomatica();
      
      // 2. Verificar configuración de horarios
      const configuracion = await this.obtenerConfiguracionEnvio();
      
      // 3. Determinar qué notificaciones enviar según horario y tipo
      const filtroHorario = this.determinarFiltroHorario(configuracion);
      
      // 4. Obtener notificaciones a enviar
      const [pendientes] = await pool.query(`
        SELECT 
          np.id,
          np.destinatario_email,
          np.destinatario_nombre,
          np.asunto,
          np.mensaje,
          np.faltante_id,
          np.tipo_frecuencia,
          DATE_FORMAT(np.fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion,
          DATE_FORMAT(np.fecha_envio_programada, '%d/%m/%Y') as fecha_programada
          
        FROM notificaciones_pendientes np
        WHERE np.estado = 'pendiente' 
        AND np.tipo_notificacion = 'email'
        AND np.destinatario_email IS NOT NULL
        AND (
          ${filtroHorario.replace('AND ', '')} -- Usar el filtro horario dinámico
        )
        ${filtroHorario}
        ORDER BY 
          CASE WHEN np.tipo_frecuencia LIKE '%_agrupado' THEN 1 ELSE 2 END,
          np.fecha_creacion ASC
        LIMIT 15
      `);
      
      if (pendientes.length === 0) {
        console.log('✅ No hay notificaciones para enviar en este momento');
        console.log(`📅 Fecha actual: ${new Date().toLocaleDateString()}`);
        console.log(`⏰ Hora actual: ${new Date().toLocaleTimeString()}`);
        return { enviadas: 0, errores: 0, agrupadas: 0 };
      }
      
      console.log(`📨 Notificaciones a procesar: ${pendientes.length}`);
      console.log(`📅 Fecha de procesamiento: ${new Date().toLocaleDateString()}`);
      
      // Log detallado por tipo
      const porTipo = this.agruparPorTipo(pendientes);
      Object.keys(porTipo).forEach(tipo => {
        const tipoEmoji = tipo.includes('agrupado') ? '📦' : '📧';
        console.log(`  ${tipoEmoji} ${tipo}: ${porTipo[tipo].length} notificaciones`);
        
        // Mostrar productos afectados de forma legible
        porTipo[tipo].forEach((notif, index) => {
          const productoLegible = notif.asunto.replace('🚨 Faltante: ', '').replace('📋 Resumen ', '');
          console.log(`    ${index + 1}. ${productoLegible}`);
        });
      });
      
      let enviadas = 0;
      let errores = 0;
      
      // Verificar configuración de email
      const emailConfigurado = await this.verificarConfiguracionEmail();
      
      for (const notif of pendientes) {
        try {
          
          if (emailConfigurado) {
            // Procesar mensaje para formato HTML legible
            const mensajeHtml = this.formatearMensajeHtml(notif.mensaje);
            
            // Envío real con formato mejorado
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'sistema@axsfitt.com',
              to: notif.destinatario_email,
              subject: notif.asunto,
              text: notif.mensaje,
              html: mensajeHtml
            });
            
            const tipoNotif = notif.tipo_frecuencia.includes('agrupado') ? 'AGRUPADO' : 'INDIVIDUAL';
            console.log(`✅ Email ${tipoNotif} enviado: ${notif.destinatario_email}`);
            console.log(`   📧 Asunto: ${notif.asunto}`);
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
   * Ejecuta la agrupación automática de notificaciones
   */
  static async ejecutarAgrupacionAutomatica() {
    try {
      console.log('🔗 Ejecutando agrupación automática...');
      
      // Verificar si hay notificaciones para agrupar
      const [candidatas] = await pool.query(`
        SELECT COUNT(*) as cantidad
        FROM notificaciones_pendientes 
        WHERE estado = 'pendiente' 
        AND tipo_frecuencia IN ('diaria', 'semanal')
        AND fecha_envio_programada <= CURDATE()
        GROUP BY fecha_envio_programada, tipo_frecuencia
        HAVING COUNT(*) > 1
      `);
      
      if (candidatas.length === 0) {
        console.log('   ℹ️ No hay notificaciones para agrupar');
        return { agrupadas: 0 };
      }
      
      // Ejecutar stored procedure
      await pool.query('CALL sp_agrupar_notificaciones_pendientes()');
      
      // Verificar resultado
      const [resultado] = await pool.query(`
        SELECT COUNT(*) as cantidad
        FROM notificaciones_pendientes 
        WHERE tipo_frecuencia LIKE '%_agrupado' 
        AND DATE(fecha_creacion) = CURDATE()
        AND estado = 'pendiente'
      `);
      
      console.log(`   ✅ Notificaciones agrupadas: ${resultado[0].cantidad}`);
      return { agrupadas: resultado[0].cantidad };
      
    } catch (error) {
      console.error('   ❌ Error en agrupación:', error.message);
      return { agrupadas: 0 };
    }
  }
  
  /**
   * Obtiene la configuración de envío
   */
  static async obtenerConfiguracionEnvio() {
    try {
      const [config] = await pool.query(`
        SELECT 
          config_frecuencia, 
          config_hora_envio, 
          config_activo,
          config_dias_semana
        FROM notificaciones_config 
        WHERE config_tipo = 'email' AND config_activo = 1
        LIMIT 1
      `);
      
      return config[0] || {
        config_frecuencia: 'inmediata',
        config_hora_envio: '09:00:00',
        config_activo: 0,
        config_dias_semana: JSON.stringify(['1', '2', '3', '4', '5'])
      };
      
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      return { 
        config_frecuencia: 'inmediata', 
        config_hora_envio: '09:00:00', 
        config_activo: 0,
        config_dias_semana: JSON.stringify(['1', '2', '3', '4', '5'])
      };
    }
  }
  
  /**
   * Determina el filtro de horario para las notificaciones
   */
  static determinarFiltroHorario(configuracion) {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutosActuales = ahora.getMinutes();
    const diaActual = ahora.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    
    console.log(`⏰ Fecha/Hora actual: ${ahora.toLocaleString('es-AR')}`);
    console.log(`📅 Día de la semana: ${diaActual} (0=Dom, 1=Lun, ..., 6=Sab)`);
    console.log(`📋 Configuración: ${configuracion.config_frecuencia} a las ${configuracion.config_hora_envio || 'N/A'}`);
    
    if (configuracion.config_frecuencia === 'inmediata') {
      console.log('✅ Frecuencia inmediata: enviando todas las inmediatas');
      return "AND np.tipo_frecuencia = 'inmediata'";
    }
    
    // Para frecuencias programadas, verificar día y horario
    let diasPermitidos = ['1', '2', '3', '4', '5']; // Lunes a viernes por defecto
    if (configuracion.config_dias_semana) {
      try {
        diasPermitidos = JSON.parse(configuracion.config_dias_semana);
      } catch (e) {
        console.warn('⚠️ Error parseando días configurados, usando L-V por defecto');
      }
    }
    
    console.log(`📅 Días configurados: [${diasPermitidos.join(', ')}]`);
    
    // Convertir día actual a formato de configuración (MySQL: 1=Lunes, 7=Domingo)
    const diaMysql = diaActual === 0 ? 7 : diaActual;
    const diaPermitido = diasPermitidos.includes(diaMysql.toString());
    
    console.log(`🔍 Día actual en formato MySQL: ${diaMysql}, ¿Permitido?: ${diaPermitido}`);
    
    if (!diaPermitido) {
      console.log('❌ Hoy no está configurado para envíos programados. Solo inmediatas.');
      return "AND np.tipo_frecuencia = 'inmediata'";
    }
    
    // Verificar horario si el día es permitido
    if (configuracion.config_hora_envio) {
      const [horaConfig, minutoConfig] = configuracion.config_hora_envio.split(':').map(Number);
      const horaActualTotal = horaActual * 60 + minutosActuales;
      const horaConfigTotal = horaConfig * 60 + minutoConfig;
      
      console.log(`🕐 Hora configurada: ${horaConfig}:${minutoConfig.toString().padStart(2, '0')}`);
      console.log(`🕐 Hora actual: ${horaActual}:${minutosActuales.toString().padStart(2, '0')}`);
      
      // Enviar si ya pasó la hora configurada (con margen de 10 minutos atrás para no perder envíos)
      if (horaActualTotal >= (horaConfigTotal - 10)) {
        console.log('✅ Es momento de enviar notificaciones programadas');
        return `AND (
          np.tipo_frecuencia = 'inmediata' OR 
          np.tipo_frecuencia = 'diaria' OR
          np.tipo_frecuencia = 'semanal' OR
          np.tipo_frecuencia LIKE '%_agrupado'
        )`;
      } else {
        const minutosRestantes = Math.floor((horaConfigTotal - horaActualTotal));
        console.log(`⏰ Aún no es momento (faltan ${minutosRestantes} minutos). Solo inmediatas.`);
        return "AND np.tipo_frecuencia = 'inmediata'";
      }
    }
    
    // Si no hay horario configurado pero el día es correcto, enviar
    console.log('✅ Día correcto, sin horario específico. Enviando programadas.');
    return `AND (
      np.tipo_frecuencia = 'inmediata' OR 
      np.tipo_frecuencia = 'diaria' OR
      np.tipo_frecuencia = 'semanal' OR
      np.tipo_frecuencia LIKE '%_agrupado'
    )`;
  }
  
  /**
   * Agrupa notificaciones por tipo para logging
   */
  static agruparPorTipo(notificaciones) {
    return notificaciones.reduce((grupos, notif) => {
      const tipo = notif.tipo_frecuencia || 'inmediata';
      if (!grupos[tipo]) grupos[tipo] = [];
      grupos[tipo].push(notif);
      return grupos;
    }, {});
  }
  
  /**
   * Formatea el mensaje de texto plano a HTML legible
   */
  static formatearMensajeHtml(mensajeTexto) {
    return mensajeTexto
      // Convertir saltos de línea
      .replace(/\n/g, '<br>')
      // Mejorar separadores
      .replace(/═+/g, '<hr style="border: 2px solid #333; margin: 15px 0;">')
      .replace(/─+/g, '<hr style="border: 1px solid #666; margin: 10px 0;">')
      // Resaltar emojis y títulos
      .replace(/(📦|🚨|📋|⚠️|🔔) (.+?):/g, '<strong style="color: #333; font-size: 16px;">$1 $2:</strong>')
      // Formatear listas con viñetas
      .replace(/• (.+?)(<br>|$)/g, '<li style="margin: 5px 0;">$1</li>')
      // Envolver listas
      .replace(/(<li[^>]*>.*?<\/li>)/gs, '<ul style="padding-left: 20px;">$1</ul>')
      // Resaltar cantidades
      .replace(/(\d+ unidades)/g, '<strong style="color: #d63384;">$1</strong>')
      // Resaltar fechas
      .replace(/(\d{2}\/\d{2}\/\d{4})/g, '<strong style="color: #0d6efd;">$1</strong>')
      // Envolver en contenedor
      .replace(/^(.+)$/, '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">$1</div>');
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