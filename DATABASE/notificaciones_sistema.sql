-- =============================================
-- SISTEMA DE NOTIFICACIONES DE STOCK BAJO
-- =============================================

-- Tabla para configuración de notificaciones
CREATE TABLE IF NOT EXISTS `notificaciones_config` (
  `config_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_tipo` enum('email','whatsapp','sms') NOT NULL,
  `config_activo` tinyint(1) DEFAULT 1,
  `config_destinatarios` json NOT NULL COMMENT 'Array de emails/teléfonos según el tipo',
  `config_template` text DEFAULT NULL COMMENT 'Template del mensaje',
  `config_umbral_notificacion` int(10) UNSIGNED DEFAULT 1 COMMENT 'Cantidad de faltantes para enviar notificación',
  `config_frecuencia_horas` int(10) UNSIGNED DEFAULT 24 COMMENT 'Cada cuántas horas enviar como máximo',
  `config_fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `config_fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla para registro de notificaciones enviadas
CREATE TABLE IF NOT EXISTS `notificaciones_log` (
  `log_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `log_config_id` int(10) UNSIGNED NOT NULL,
  `log_tipo` enum('email','whatsapp','sms') NOT NULL,
  `log_destinatario` varchar(255) NOT NULL,
  `log_mensaje` text NOT NULL,
  `log_faltantes_ids` json DEFAULT NULL COMMENT 'IDs de faltantes incluidos en la notificación',
  `log_estado` enum('pendiente','enviado','fallido') DEFAULT 'pendiente',
  `log_error` text DEFAULT NULL,
  `log_fecha_programada` timestamp NOT NULL DEFAULT current_timestamp(),
  `log_fecha_envio` timestamp NULL DEFAULT NULL,
  `log_intentos` int(10) UNSIGNED DEFAULT 0,
  PRIMARY KEY (`log_id`),
  KEY `log_config_id` (`log_config_id`),
  KEY `log_estado` (`log_estado`),
  KEY `log_fecha_programada` (`log_fecha_programada`),
  CONSTRAINT `fk_notificaciones_log_config` FOREIGN KEY (`log_config_id`) REFERENCES `notificaciones_config` (`config_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar configuración por defecto para email
INSERT INTO `notificaciones_config` (
  `config_tipo`,
  `config_activo`,
  `config_destinatarios`,
  `config_template`,
  `config_umbral_notificacion`,
  `config_frecuencia_horas`
) VALUES (
  'email',
  0, -- Desactivado por defecto hasta configurar
  JSON_ARRAY('admin@axsfitt.com'),
  '🚨 ALERTA DE STOCK BAJO - AXSFITT\n\nSe han detectado {{cantidad_faltantes}} productos con stock por debajo del mínimo:\n\n{{lista_productos}}\n\nPor favor, revise el sistema y genere los pedidos correspondientes.\n\n---\nSistema de Gestión AXSFITT\nFecha: {{fecha_actual}}',
  1,
  6
);

-- Insertar configuración por defecto para WhatsApp  
INSERT INTO `notificaciones_config` (
  `config_tipo`,
  `config_activo`,
  `config_destinatarios`,
  `config_template`,
  `config_umbral_notificacion`,
  `config_frecuencia_horas`
) VALUES (
  'whatsapp',
  0, -- Desactivado por defecto hasta configurar
  JSON_ARRAY('+5491123456789'),
  '🚨 *STOCK BAJO - AXSFITT*\n\n*{{cantidad_faltantes}} productos* con stock bajo:\n{{lista_productos_simple}}\n\n⚠️ Revisar sistema y generar pedidos\n📅 {{fecha_actual}}',
  2,
  12
);

-- =============================================
-- STORED PROCEDURE: Verificar y enviar notificaciones
-- =============================================

DELIMITER $$

CREATE PROCEDURE sp_procesar_notificaciones_stock()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_config_id INT;
    DECLARE v_tipo VARCHAR(20);
    DECLARE v_destinatarios JSON;
    DECLARE v_template TEXT;
    DECLARE v_umbral INT;
    DECLARE v_frecuencia_horas INT;
    DECLARE v_cantidad_faltantes INT;
    
    -- Cursor para configuraciones activas
    DECLARE config_cursor CURSOR FOR
        SELECT config_id, config_tipo, config_destinatarios, config_template, 
               config_umbral_notificacion, config_frecuencia_horas
        FROM notificaciones_config 
        WHERE config_activo = 1;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Contar faltantes detectados actuales
    SELECT COUNT(*) INTO v_cantidad_faltantes
    FROM faltantes 
    WHERE faltante_estado = 'detectado';
    
    -- Si no hay faltantes, no procesar notificaciones
    IF v_cantidad_faltantes = 0 THEN
        SELECT 'No hay faltantes detectados' as resultado;
        LEAVE sp_main;
    END IF;
    
    -- Etiqueta para el procedimiento principal
    sp_main: BEGIN
    
    OPEN config_cursor;
    
    config_loop: LOOP
        FETCH config_cursor INTO v_config_id, v_tipo, v_destinatarios, v_template, v_umbral, v_frecuencia_horas;
        
        IF done THEN
            LEAVE config_loop;
        END IF;
        
        -- Verificar si se alcanzó el umbral de notificación
        IF v_cantidad_faltantes >= v_umbral THEN
            -- Verificar si ya se envió una notificación reciente
            IF NOT EXISTS (
                SELECT 1 FROM notificaciones_log 
                WHERE log_config_id = v_config_id
                AND log_estado = 'enviado'
                AND log_fecha_envio >= DATE_SUB(NOW(), INTERVAL v_frecuencia_horas HOUR)
            ) THEN
                -- Crear registro de notificación pendiente
                INSERT INTO notificaciones_log (
                    log_config_id,
                    log_tipo,
                    log_destinatario,
                    log_mensaje,
                    log_faltantes_ids,
                    log_estado
                ) 
                SELECT 
                    v_config_id,
                    v_tipo,
                    JSON_UNQUOTE(JSON_EXTRACT(v_destinatarios, CONCAT('$[', numbers.n, ']'))),
                    v_template, -- El template se procesará en la aplicación
                    (SELECT JSON_ARRAYAGG(faltante_id) FROM faltantes WHERE faltante_estado = 'detectado'),
                    'pendiente'
                FROM (
                    SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL 
                    SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                ) numbers
                WHERE JSON_EXTRACT(v_destinatarios, CONCAT('$[', numbers.n, ']')) IS NOT NULL;
            END IF;
        END IF;
        
    END LOOP;
    
    CLOSE config_cursor;
    
    END sp_main;
    
    -- Retornar resumen
    SELECT 
        v_cantidad_faltantes as faltantes_detectados,
        (SELECT COUNT(*) FROM notificaciones_log WHERE log_estado = 'pendiente') as notificaciones_pendientes,
        'Procesamiento completado' as resultado;
        
END$$

-- Procedimiento para obtener datos de notificaciones pendientes
CREATE PROCEDURE sp_obtener_notificaciones_pendientes()
BEGIN
    SELECT 
        nl.log_id,
        nl.log_tipo,
        nl.log_destinatario,
        nl.log_mensaje,
        nl.log_faltantes_ids,
        nc.config_template,
        (SELECT COUNT(*) FROM faltantes WHERE faltante_estado = 'detectado') as cantidad_faltantes
    FROM notificaciones_log nl
    JOIN notificaciones_config nc ON nl.log_config_id = nc.config_id
    WHERE nl.log_estado = 'pendiente'
    ORDER BY nl.log_fecha_programada ASC;
END$$

-- Procedimiento para marcar notificación como enviada
CREATE PROCEDURE sp_marcar_notificacion_enviada(IN p_log_id INT)
BEGIN
    UPDATE notificaciones_log 
    SET log_estado = 'enviado', 
        log_fecha_envio = NOW(),
        log_intentos = log_intentos + 1
    WHERE log_id = p_log_id;
END$$

-- Procedimiento para marcar notificación como fallida
CREATE PROCEDURE sp_marcar_notificacion_fallida(IN p_log_id INT, IN p_error TEXT)
BEGIN
    UPDATE notificaciones_log 
    SET log_estado = 'fallido', 
        log_error = p_error,
        log_intentos = log_intentos + 1
    WHERE log_id = p_log_id;
END$$

DELIMITER ;

-- =============================================
-- EVENT: Ejecutar verificación de notificaciones cada 30 minutos
-- =============================================

-- Habilitar el programador de eventos si no está activo
SET GLOBAL event_scheduler = ON;

-- Crear evento para verificar notificaciones automáticamente
DROP EVENT IF EXISTS evt_verificar_notificaciones_stock;

CREATE EVENT evt_verificar_notificaciones_stock
ON SCHEDULE EVERY 30 MINUTE
STARTS CURRENT_TIMESTAMP
DO
  CALL sp_procesar_notificaciones_stock();

-- =============================================
-- VISTAS para facilitar consultas
-- =============================================

-- Vista para resumen de configuración de notificaciones
CREATE OR REPLACE VIEW v_resumen_notificaciones AS
SELECT 
    config_id,
    config_tipo,
    config_activo,
    JSON_LENGTH(config_destinatarios) as cantidad_destinatarios,
    config_umbral_notificacion,
    config_frecuencia_horas,
    (SELECT COUNT(*) FROM notificaciones_log WHERE log_config_id = nc.config_id AND log_estado = 'enviado' AND DATE(log_fecha_envio) = CURDATE()) as enviadas_hoy
FROM notificaciones_config nc
ORDER BY config_tipo;

-- Vista para faltantes con información completa para notificaciones
CREATE OR REPLACE VIEW v_faltantes_notificacion AS
SELECT 
    f.faltante_id,
    CASE 
        WHEN f.faltante_producto_id IS NOT NULL THEN p.producto_nombre
        WHEN f.faltante_variante_id IS NOT NULL THEN CONCAT(p2.producto_nombre, ' - ', GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', '))
    END as producto_completo,
    f.faltante_cantidad_faltante,
    s.cantidad as stock_actual,
    s.stock_minimo,
    f.faltante_fecha_deteccion,
    f.faltante_estado
FROM faltantes f
LEFT JOIN productos p ON f.faltante_producto_id = p.producto_id
LEFT JOIN variantes v ON f.faltante_variante_id = v.variante_id
LEFT JOIN productos p2 ON v.producto_id = p2.producto_id
LEFT JOIN valores_variantes vv ON vv.variante_id = v.variante_id
LEFT JOIN atributos a ON a.atributo_id = vv.atributo_id
LEFT JOIN stock s ON (s.producto_id = f.faltante_producto_id OR s.variante_id = f.faltante_variante_id)
WHERE f.faltante_estado = 'detectado'
GROUP BY f.faltante_id, f.faltante_producto_id, f.faltante_variante_id
ORDER BY f.faltante_fecha_deteccion DESC;