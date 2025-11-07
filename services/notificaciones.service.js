import { pool } from '../db.js';
import transporter from '../emailConfig.js';
import https from 'https';

/**
 * Servicio para gestión de notificaciones de stock bajo
 * Maneja envío de emails, WhatsApp y SMS para alertas de faltantes
 */
export class NotificacionesService {
  
  /**
   * Retorna la instancia existente de transporter
   * @returns {Object} Transporter configurado existente
   */
  static getEmailTransporter() {
    return transporter;
  }

  /**
   * Procesa las notificaciones pendientes
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  static async procesarNotificacionesPendientes() {
    try {
      console.log('🔔 Procesando notificaciones pendientes...');
      
      // Ejecutar el stored procedure para crear notificaciones
      await pool.query('CALL sp_procesar_notificaciones_stock()');
      
      // Obtener notificaciones pendientes
      const [notificaciones] = await pool.query('CALL sp_obtener_notificaciones_pendientes()');
      
      if (!notificaciones[0] || notificaciones[0].length === 0) {
        console.log('📭 No hay notificaciones pendientes');
        return { procesadas: 0, exitosas: 0, fallidas: 0 };
      }

      let exitosas = 0;
      let fallidas = 0;

      // Procesar cada notificación
      for (const notificacion of notificaciones[0]) {
        try {
          const mensaje = await this.procesarTemplate(notificacion);
          
          switch (notificacion.log_tipo) {
            case 'email':
              await this.enviarEmail(notificacion.log_destinatario, mensaje);
              break;
            case 'whatsapp':
              await this.enviarWhatsApp(notificacion.log_destinatario, mensaje);
              break;
            case 'sms':
              await this.enviarSMS(notificacion.log_destinatario, mensaje);
              break;
          }
          
          // Marcar como enviado
          await pool.query('CALL sp_marcar_notificacion_enviada(?)', [notificacion.log_id]);
          exitosas++;
          
          console.log(`✅ Notificación ${notificacion.log_tipo} enviada a ${notificacion.log_destinatario}`);
          
        } catch (error) {
          console.error(`❌ Error enviando notificación ${notificacion.log_id}:`, error.message);
          
          // Marcar como fallida
          await pool.query('CALL sp_marcar_notificacion_fallida(?, ?)', [
            notificacion.log_id,
            error.message
          ]);
          fallidas++;
        }
      }

      const resultado = {
        procesadas: notificaciones[0].length,
        exitosas,
        fallidas
      };

      console.log('📊 Resumen de notificaciones:', resultado);
      return resultado;
      
    } catch (error) {
      console.error('❌ Error procesando notificaciones:', error);
      throw error;
    }
  }

  /**
   * Procesa el template de mensaje con los datos actuales
   * @param {Object} notificacion - Datos de la notificación
   * @returns {Promise<string>} Mensaje procesado
   */
  static async procesarTemplate(notificacion) {
    try {
      // Obtener datos actuales de faltantes
      const [faltantes] = await pool.query(`
        SELECT * FROM v_faltantes_notificacion 
        ORDER BY faltante_fecha_deteccion DESC
      `);

      const cantidad_faltantes = faltantes.length;
      const fecha_actual = new Date().toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Lista detallada para email
      const lista_productos = faltantes.map(f => 
        `• ${f.producto_completo}: Stock actual ${f.stock_actual}, mínimo ${f.stock_minimo} (Faltan ${f.faltante_cantidad_faltante})`
      ).join('\n');

      // Lista simple para WhatsApp
      const lista_productos_simple = faltantes.map(f => 
        `• ${f.producto_completo} (${f.faltante_cantidad_faltante})`
      ).join('\n');

      // Reemplazar variables en el template
      let mensaje = notificacion.config_template
        .replace('{{cantidad_faltantes}}', cantidad_faltantes)
        .replace('{{fecha_actual}}', fecha_actual)
        .replace('{{lista_productos}}', lista_productos)
        .replace('{{lista_productos_simple}}', lista_productos_simple);

      return mensaje;
      
    } catch (error) {
      console.error('❌ Error procesando template:', error);
      throw error;
    }
  }

  /**
   * Envía email usando la instancia existente de transporter
   * @param {string} destinatario - Email del destinatario
   * @param {string} mensaje - Contenido del mensaje
   */
  static async enviarEmail(destinatario, mensaje) {
    try {
      const emailTransporter = this.getEmailTransporter();
      
      const mailOptions = {
        from: `"AXSFITT Sistema" <${process.env.EMAIL_USER}>`,
        to: destinatario,
        subject: '🚨 Alerta de Stock Bajo - AXSFITT',
        text: mensaje,
        html: mensaje.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      };

      const info = await emailTransporter.sendMail(mailOptions);
      console.log('📧 Email enviado:', info.messageId);
      
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }

  /**
   * Envía WhatsApp usando API (Twilio, WhatsApp Business API, etc.)
   * @param {string} numero - Número de teléfono
   * @param {string} mensaje - Contenido del mensaje
   */
  static async enviarWhatsApp(numero, mensaje) {
    try {
      // Ejemplo usando Twilio WhatsApp API
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        
        const postData = JSON.stringify({
          From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          To: `whatsapp:${numero}`,
          Body: mensaje
        });

        const options = {
          hostname: 'api.twilio.com',
          port: 443,
          path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        return new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 201) {
                console.log('📱 WhatsApp enviado exitosamente');
                resolve(JSON.parse(data));
              } else {
                reject(new Error(`WhatsApp API error: ${res.statusCode} - ${data}`));
              }
            });
          });

          req.on('error', reject);
          req.write(postData);
          req.end();
        });
      } else {
        // Si no hay configuración de Twilio, simular envío
        console.log('📱 Simulando envío de WhatsApp a:', numero);
        console.log('📄 Mensaje:', mensaje);
      }
      
    } catch (error) {
      console.error('❌ Error enviando WhatsApp:', error);
      throw new Error(`Error enviando WhatsApp: ${error.message}`);
    }
  }

  /**
   * Envía SMS usando API
   * @param {string} numero - Número de teléfono
   * @param {string} mensaje - Contenido del mensaje
   */
  static async enviarSMS(numero, mensaje) {
    try {
      // Ejemplo básico - implementar según proveedor
      console.log('📲 Simulando envío de SMS a:', numero);
      console.log('📄 Mensaje:', mensaje);
      
      // Aquí implementar la API de SMS de tu proveedor
      // (Twilio, AWS SNS, etc.)
      
    } catch (error) {
      console.error('❌ Error enviando SMS:', error);
      throw new Error(`Error enviando SMS: ${error.message}`);
    }
  }

  /**
   * Obtiene la configuración de notificaciones
   * @returns {Promise<Object>} Configuración simplificada
   */
  static async obtenerConfiguracion() {
    try {
      console.log('📋 Obteniendo configuración de notificaciones...');
      
      const [configs] = await pool.query(`
        SELECT 
          config_tipo,
          config_activo,
          config_frecuencia,
          config_hora_envio,
          config_dias_semana,
          config_plantilla_personalizada
        FROM notificaciones_config 
        WHERE config_usuario_id = 1
      `);
      
      const configuracion = {
        email: {
          activo: false,
          frecuencia: 'inmediata',
          diasSemana: ['1', '2', '3', '4', '5'],
          horaEnvio: '09:00',
          plantillaPersonalizada: null
        },
        whatsapp: {
          activo: false,
          frecuencia: 'inmediata', 
          diasSemana: ['1', '2', '3', '4', '5'],
          horaEnvio: '09:00',
          plantillaPersonalizada: null
        }
      };
      
      // Mapear los resultados de la base de datos
      configs.forEach(config => {
        if (configuracion[config.config_tipo]) {
          configuracion[config.config_tipo] = {
            activo: Boolean(config.config_activo),
            frecuencia: config.config_frecuencia,
            diasSemana: config.config_dias_semana ? JSON.parse(config.config_dias_semana) : ['1', '2', '3', '4', '5'],
            horaEnvio: config.config_hora_envio || '09:00',
            plantillaPersonalizada: config.config_plantilla_personalizada
          };
        }
      });
      
      console.log('✅ Configuración obtenida:', configuracion);
      return configuracion;
      
    } catch (error) {
      console.error('❌ Error obteniendo configuración:', error);
      throw error;
    }
  }

  /**
   * Actualiza la configuración de notificaciones
   * @param {string} configTipo - Tipo de configuración ('email' o 'whatsapp')
   * @param {Object} datos - Nuevos datos
   */
  static async actualizarConfiguracion(configTipo, datos) {
    try {
      const { activo, frecuencia, horaEnvio, diasSemana, plantillaPersonalizada } = datos;
      
      await pool.query(`
        UPDATE notificaciones_config 
        SET config_activo = ?,
            config_frecuencia = ?,
            config_hora_envio = ?,
            config_dias_semana = ?,
            config_plantilla_personalizada = ?,
            config_fecha_actualizacion = NOW()
        WHERE config_tipo = ? AND config_usuario_id = 1
      `, [activo, frecuencia, horaEnvio, JSON.stringify(diasSemana), plantillaPersonalizada, configTipo]);
      
      console.log(`✅ Configuración ${configTipo} actualizada`);
      
    } catch (error) {
      console.error('❌ Error actualizando configuración:', error);
      throw error;
    }
  }

  /**
   * Ejecuta prueba de notificación
   * @param {string} tipo - Tipo de notificación
   * @param {string} destinatario - Destinatario de prueba
   */
  static async enviarPrueba(tipo, destinatario) {
    try {
      const mensaje = `🔧 PRUEBA - Sistema de Notificaciones AXSFITT\n\nEsto es una prueba del sistema de notificaciones.\nTipo: ${tipo}\nFecha: ${new Date().toLocaleString('es-AR')}\n\n✅ Si recibes este mensaje, el sistema está funcionando correctamente.`;
      
      switch (tipo) {
        case 'email':
          await this.enviarEmail(destinatario, mensaje);
          break;
        case 'whatsapp':
          await this.enviarWhatsApp(destinatario, mensaje);
          break;
        case 'sms':
          await this.enviarSMS(destinatario, mensaje);
          break;
        default:
          throw new Error('Tipo de notificación no válido');
      }
      
      console.log(`✅ Prueba de ${tipo} enviada a ${destinatario}`);
      
    } catch (error) {
      console.error('❌ Error en prueba de notificación:', error);
      throw error;
    }
  }

  /**
   * Obtiene los destinatarios configurados para un tipo de notificación
   * @param {string} tipo - Tipo de notificación (email, whatsapp, sms)
   * @returns {Promise<Array>} Lista de destinatarios
   */
  static async obtenerDestinatarios(tipo) {
    try {
      const [config] = await pool.query(`
        SELECT config_destinatarios 
        FROM notificaciones_config 
        WHERE config_tipo = ?
      `, [tipo]);
      
      if (config.length === 0) {
        return [];
      }
      
      return JSON.parse(config[0].config_destinatarios || '[]');
    } catch (error) {
      console.error('❌ Error obteniendo destinatarios:', error);
      throw error;
    }
  }

  /**
   * Actualiza la lista de destinatarios para un tipo de notificación
   * @param {string} tipo - Tipo de notificación
   * @param {Array} destinatarios - Nueva lista de destinatarios
   */
  static async actualizarDestinatarios(tipo, destinatarios) {
    try {
      await pool.query(`
        UPDATE notificaciones_config 
        SET config_destinatarios = ? 
        WHERE config_tipo = ?
      `, [JSON.stringify(destinatarios), tipo]);
      
      console.log(`✅ Destinatarios actualizados para ${tipo}:`, destinatarios);
    } catch (error) {
      console.error('❌ Error actualizando destinatarios:', error);
      throw error;
    }
  }

  /**
   * Activa o desactiva las notificaciones de un tipo específico
   * @param {string} tipo - Tipo de notificación
   * @param {boolean} activo - Estado activo/inactivo
   */
  static async toggleNotificaciones(tipo, activo) {
    try {
      await pool.query(`
        UPDATE notificaciones_config 
        SET config_activo = ? 
        WHERE config_tipo = ?
      `, [activo ? 1 : 0, tipo]);
      
      console.log(`✅ Notificaciones ${tipo} ${activo ? 'activadas' : 'desactivadas'}`);
    } catch (error) {
      console.error('❌ Error actualizando estado de notificaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los contactos
   * @returns {Promise<Array>} Lista de contactos
   */
  static async obtenerContactos() {
    try {
      const [contactos] = await pool.query(`
        SELECT 
          contacto_id,
          contacto_nombre,
          contacto_email,
          contacto_telefono,
          contacto_tipo,
          contacto_activo,
          fecha_creacion
        FROM notificaciones_contactos 
        WHERE contacto_email != 'cp15414621@gmail.com'
        ORDER BY contacto_activo DESC, contacto_nombre
      `);
      
      return contactos;
    } catch (error) {
      console.error('❌ Error obteniendo contactos:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo contacto
   * @param {Object} datos - Datos del contacto
   * @returns {Promise<Object>} Contacto creado
   */
  static async crearContacto(datos) {
    try {
      const { nombre, email, telefono, tipo } = datos;
      
      // Evitar crear contacto con email del administrador
      if (email === 'cp15414621@gmail.com') {
        throw new Error('No se puede agregar el email del administrador como contacto');
      }
      
      const [result] = await pool.query(`
        INSERT INTO notificaciones_contactos 
        (contacto_nombre, contacto_email, contacto_telefono, contacto_tipo, contacto_activo)
        VALUES (?, ?, ?, ?, 1)
      `, [nombre, email, telefono, tipo]);
      
      console.log(`✅ Contacto creado: ${nombre}`);
      return { contacto_id: result.insertId, ...datos };
    } catch (error) {
      console.error('❌ Error creando contacto:', error);
      throw error;
    }
  }

  /**
   * Actualiza un contacto existente
   * @param {number} contactoId - ID del contacto
   * @param {Object} datos - Nuevos datos del contacto
   */
  static async actualizarContacto(contactoId, datos) {
    try {
      // Si solo se está actualizando el estado activo
      if (Object.keys(datos).length === 1 && 'activo' in datos) {
        await pool.query(`
          UPDATE notificaciones_contactos 
          SET 
            contacto_activo = ?,
            fecha_modificacion = CURRENT_TIMESTAMP
          WHERE contacto_id = ?
        `, [datos.activo ? 1 : 0, contactoId]);
        
        console.log(`✅ Estado del contacto actualizado: ${datos.activo ? 'Activado' : 'Desactivado'}`);
        return;
      }
      
      // Actualización completa
      const { nombre, email, telefono, tipo, activo } = datos;
      
      await pool.query(`
        UPDATE notificaciones_contactos 
        SET 
          contacto_nombre = ?,
          contacto_email = ?,
          contacto_telefono = ?,
          contacto_tipo = ?,
          contacto_activo = ?,
          fecha_modificacion = CURRENT_TIMESTAMP
        WHERE contacto_id = ?
      `, [nombre, email, telefono, tipo, activo ? 1 : 0, contactoId]);
      
      console.log(`✅ Contacto actualizado: ${nombre}`);
    } catch (error) {
      console.error('❌ Error actualizando contacto:', error);
      throw error;
    }
  }

  /**
   * Elimina un contacto físicamente de la base de datos
   * @param {number} contactoId - ID del contacto
   */
  static async eliminarContacto(contactoId) {
    try {
      // Obtener información del contacto antes de eliminar
      const [contacto] = await pool.query(`
        SELECT contacto_nombre FROM notificaciones_contactos WHERE contacto_id = ?
      `, [contactoId]);
      
      const nombreContacto = contacto[0]?.contacto_nombre || `ID ${contactoId}`;
      
      // Eliminación física
      await pool.query(`
        DELETE FROM notificaciones_contactos 
        WHERE contacto_id = ?
      `, [contactoId]);
      
      console.log(`🗑️ Contacto eliminado físicamente: ${nombreContacto}`);
    } catch (error) {
      console.error('❌ Error eliminando contacto:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de frecuencia
   * @returns {Promise<Object>} Configuración de frecuencia
   */
  static async obtenerConfiguracionFrecuencia() {
    try {
      const [config] = await pool.query(`
        SELECT 
          config_tipo,
          config_frecuencia,
          config_hora_envio,
          config_activo
        FROM notificaciones_config
      `);
      
      return config;
    } catch (error) {
      console.error('❌ Error obteniendo configuración de frecuencia:', error);
      throw error;
    }
  }

  /**
   * Actualiza la configuración de frecuencia
   * @param {string} tipo - Tipo de notificación
   * @param {Object} datos - Configuración de frecuencia
   */
  static async actualizarConfiguracionFrecuencia(tipo, datos) {
    try {
      const { frecuencia, horaEnvio } = datos;
      
      await pool.query(`
        UPDATE notificaciones_config 
        SET 
          config_frecuencia = ?,
          config_hora_envio = ?
        WHERE config_tipo = ?
      `, [frecuencia, horaEnvio, tipo]);
      
      console.log(`✅ Configuración de frecuencia actualizada para ${tipo}`);
    } catch (error) {
      console.error('❌ Error actualizando configuración de frecuencia:', error);
      throw error;
    }
  }

  /**
   * Obtiene la lista de faltantes detectados
   * @returns {Promise<Array>} Lista de faltantes
   */
  static async obtenerFaltantesDetectados() {
    try {
      console.log('📋 Obteniendo faltantes detectados...');
      
      const [faltantes] = await pool.query(`
        SELECT * FROM v_faltantes_notificacion
        ORDER BY faltante_fecha_deteccion DESC
      `);
      
      console.log(`✅ ${faltantes.length} faltantes encontrados`);
      return faltantes;
    } catch (error) {
      console.error('❌ Error obteniendo faltantes:', error);
      throw error;
    }
  }
}