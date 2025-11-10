-- Arreglar el trigger para notificaciones de faltantes
-- Problema: El trigger no incluye el campo tipo_notificacion que es requerido
-- También maneja el caso cuando config_frecuencia es NULL

USE axsfitt;

-- Primero actualizamos la configuración de email para tener una frecuencia válida
UPDATE notificaciones_config 
SET config_frecuencia = 'inmediata' 
WHERE config_tipo = 'email' AND config_frecuencia IS NULL;

-- Eliminamos el trigger existente
DROP TRIGGER IF EXISTS trg_notificacion_faltante_inmediata;

-- Creamos el trigger corregido
DELIMITER $$
CREATE TRIGGER `trg_notificacion_faltante_inmediata` AFTER INSERT ON `faltantes` FOR EACH ROW 
BEGIN
    DECLARE config_activo_val INT DEFAULT 0;
    DECLARE config_frecuencia_val VARCHAR(20) DEFAULT '';
    
    -- Obtener configuración (manejar NULL en frecuencia)
    SELECT config_activo, IFNULL(config_frecuencia, 'inmediata') 
    INTO config_activo_val, config_frecuencia_val
    FROM notificaciones_config 
    WHERE config_tipo = 'email' 
    LIMIT 1;
    
    -- Si está activo y es inmediata, crear notificación
    IF config_activo_val = 1 AND config_frecuencia_val = 'inmediata' THEN
        INSERT INTO notificaciones_pendientes (
            tipo_notificacion,
            destinatario_email,
            asunto,
            mensaje,
            faltante_id,
            estado,
            fecha_creacion
        ) VALUES (
            'email',
            'fabricio.gomez4371@gmail.com',
            CONCAT('🚨 ALERTA: Nuevo faltante detectado'),
            CONCAT(
                'Se ha detectado un nuevo faltante en el inventario.\n\n',
                'Detalles:\n',
                '• ID: ', NEW.faltante_id, '\n',
                '• Cantidad faltante: ', NEW.faltante_cantidad_faltante, ' unidades\n',
                '• Estado: ', NEW.faltante_estado, '\n',
                '• Fecha: ', NEW.faltante_fecha_deteccion, '\n\n',
                'Ingrese al sistema para revisar los detalles y generar pedidos.\n\n',
                'Sistema AXSFITT'
            ),
            NEW.faltante_id,
            'pendiente',
            NOW()
        );
    END IF;
END$$
DELIMITER ;

-- Verificar que la configuración esté correcta
SELECT 'Configuración actual de notificaciones:' as status;
SELECT config_tipo, config_activo, config_frecuencia 
FROM notificaciones_config 
WHERE config_tipo = 'email';