import { pool } from '../db.js';

/**
 * Obtener lista de notificaciones pendientes y enviadas
 */
export const listarNotificaciones = async (req, res) => {
  try {
    const [notificaciones] = await pool.query(`
      SELECT 
        id,
        tipo_notificacion,
        destinatario_email,
        destinatario_nombre,
        destinatario_telefono,
        COALESCE(destinatario_email, destinatario_telefono) as destinatario,
        asunto,
        mensaje as cuerpo,
        faltante_id,
        tipo_frecuencia,
        fecha_creacion,
        fecha_envio,
        fecha_envio_programada,
        estado,
        error_mensaje
      FROM notificaciones_pendientes 
      ORDER BY fecha_creacion DESC
      LIMIT 1000
    `);

    res.json(notificaciones);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ message: 'Error al obtener las notificaciones', error });
  }
};