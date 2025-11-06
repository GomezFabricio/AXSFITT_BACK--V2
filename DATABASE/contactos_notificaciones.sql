-- Script para crear tabla de contactos y mejorar sistema de notificaciones
-- Ejecutar después de notificaciones_sistema.sql

-- Tabla de contactos para gestionar personas que reciben notificaciones
CREATE TABLE IF NOT EXISTS `notificaciones_contactos` (
  `contacto_id` int NOT NULL AUTO_INCREMENT,
  `contacto_nombre` varchar(100) NOT NULL COMMENT 'Nombre completo del contacto',
  `contacto_email` varchar(255) DEFAULT NULL COMMENT 'Email del contacto',
  `contacto_telefono` varchar(20) DEFAULT NULL COMMENT 'Teléfono/WhatsApp del contacto',
  `contacto_activo` tinyint(1) DEFAULT 1 COMMENT 'Estado del contacto (1=activo, 0=inactivo)',
  `contacto_tipo` ENUM('email', 'whatsapp', 'ambos') DEFAULT 'email' COMMENT 'Tipo de notificaciones que recibe',
  `fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`contacto_id`),
  UNIQUE KEY `unique_email` (`contacto_email`),
  INDEX `idx_activo_tipo` (`contacto_activo`, `contacto_tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Contactos para notificaciones de stock bajo';

-- Agregar campos de configuración de frecuencia a la tabla de configuración
ALTER TABLE `notificaciones_config` 
ADD COLUMN IF NOT EXISTS `config_frecuencia` ENUM('inmediata', 'diaria', 'semanal') DEFAULT 'inmediata' COMMENT 'Frecuencia de envío de notificaciones',
ADD COLUMN IF NOT EXISTS `config_hora_envio` TIME DEFAULT '09:00:00' COMMENT 'Hora del día para envío programado',
ADD COLUMN IF NOT EXISTS `config_dia_semana` TINYINT DEFAULT 1 COMMENT 'Día de la semana para envío semanal (1=Lunes, 7=Domingo)';

-- Insertar algunos contactos de ejemplo
INSERT IGNORE INTO `notificaciones_contactos` 
(`contacto_nombre`, `contacto_email`, `contacto_tipo`, `contacto_activo`) 
VALUES 
('Administrador Sistema', 'fabricio.gomez4371@gmail.com', 'email', 1),
('Gerente de Stock', 'cp15414621@gmail.com', 'email', 1);

-- Procedimiento para obtener contactos por tipo
DELIMITER //

CREATE OR REPLACE PROCEDURE `sp_obtener_contactos`(
    IN p_tipo VARCHAR(20)
)
BEGIN
    IF p_tipo = 'todos' THEN
        SELECT 
            contacto_id,
            contacto_nombre,
            contacto_email,
            contacto_telefono,
            contacto_tipo,
            contacto_activo,
            fecha_creacion
        FROM notificaciones_contactos 
        WHERE contacto_activo = 1
        ORDER BY contacto_nombre;
    ELSE
        SELECT 
            contacto_id,
            contacto_nombre,
            contacto_email,
            contacto_telefono,
            contacto_tipo,
            contacto_activo,
            fecha_creacion
        FROM notificaciones_contactos 
        WHERE contacto_activo = 1 
        AND (contacto_tipo = p_tipo OR contacto_tipo = 'ambos')
        ORDER BY contacto_nombre;
    END IF;
END //

-- Procedimiento para agregar nuevo contacto
CREATE OR REPLACE PROCEDURE `sp_agregar_contacto`(
    IN p_nombre VARCHAR(100),
    IN p_email VARCHAR(255),
    IN p_telefono VARCHAR(20),
    IN p_tipo ENUM('email', 'whatsapp', 'ambos')
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    INSERT INTO notificaciones_contactos 
    (contacto_nombre, contacto_email, contacto_telefono, contacto_tipo)
    VALUES (p_nombre, p_email, p_telefono, p_tipo);
    
    COMMIT;
    
    SELECT LAST_INSERT_ID() as contacto_id;
END //

-- Procedimiento para actualizar contacto
CREATE OR REPLACE PROCEDURE `sp_actualizar_contacto`(
    IN p_contacto_id INT,
    IN p_nombre VARCHAR(100),
    IN p_email VARCHAR(255),
    IN p_telefono VARCHAR(20),
    IN p_tipo ENUM('email', 'whatsapp', 'ambos'),
    IN p_activo TINYINT(1)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE notificaciones_contactos 
    SET 
        contacto_nombre = p_nombre,
        contacto_email = p_email,
        contacto_telefono = p_telefono,
        contacto_tipo = p_tipo,
        contacto_activo = p_activo,
        fecha_modificacion = CURRENT_TIMESTAMP
    WHERE contacto_id = p_contacto_id;
    
    COMMIT;
END //

-- Procedimiento para eliminar contacto (soft delete)
CREATE OR REPLACE PROCEDURE `sp_eliminar_contacto`(
    IN p_contacto_id INT
)
BEGIN
    UPDATE notificaciones_contactos 
    SET contacto_activo = 0,
        fecha_modificacion = CURRENT_TIMESTAMP
    WHERE contacto_id = p_contacto_id;
END //

-- Procedimiento mejorado para obtener destinatarios desde contactos
CREATE OR REPLACE PROCEDURE `sp_obtener_destinatarios_activos`(
    IN p_tipo VARCHAR(20)
)
BEGIN
    IF p_tipo = 'email' THEN
        SELECT 
            contacto_email as destinatario,
            contacto_nombre as nombre
        FROM notificaciones_contactos 
        WHERE contacto_activo = 1 
        AND contacto_email IS NOT NULL
        AND (contacto_tipo = 'email' OR contacto_tipo = 'ambos');
    ELSEIF p_tipo = 'whatsapp' THEN
        SELECT 
            contacto_telefono as destinatario,
            contacto_nombre as nombre
        FROM notificaciones_contactos 
        WHERE contacto_activo = 1 
        AND contacto_telefono IS NOT NULL
        AND (contacto_tipo = 'whatsapp' OR contacto_tipo = 'ambos');
    END IF;
END //

DELIMITER ;

-- Actualizar configuración existente con nueva frecuencia
UPDATE notificaciones_config 
SET config_frecuencia = 'inmediata' 
WHERE config_frecuencia IS NULL;

-- Actualizar el evento programado para considerar frecuencia
DROP EVENT IF EXISTS evt_procesar_notificaciones_stock;

DELIMITER //

CREATE EVENT evt_procesar_notificaciones_stock
ON SCHEDULE EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_config_tipo VARCHAR(20);
    DECLARE v_config_frecuencia VARCHAR(20);
    DECLARE v_config_activo TINYINT(1);
    DECLARE v_ultima_ejecucion TIMESTAMP;
    DECLARE v_ahora TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    DECLARE v_debe_ejecutar BOOLEAN DEFAULT FALSE;
    
    DECLARE config_cursor CURSOR FOR
        SELECT config_tipo, config_frecuencia, config_activo
        FROM notificaciones_config 
        WHERE config_activo = 1;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN config_cursor;
    
    config_loop: LOOP
        FETCH config_cursor INTO v_config_tipo, v_config_frecuencia, v_config_activo;
        
        IF done THEN
            LEAVE config_loop;
        END IF;
        
        -- Obtener última ejecución de este tipo
        SELECT COALESCE(MAX(log_fecha_envio), '2024-01-01 00:00:00')
        INTO v_ultima_ejecucion
        FROM notificaciones_log 
        WHERE log_tipo = v_config_tipo 
        AND log_estado = 'enviado';
        
        SET v_debe_ejecutar = FALSE;
        
        -- Determinar si debe ejecutar según frecuencia
        CASE v_config_frecuencia
            WHEN 'inmediata' THEN
                SET v_debe_ejecutar = TRUE;
            WHEN 'diaria' THEN
                IF DATEDIFF(v_ahora, v_ultima_ejecucion) >= 1 
                   AND HOUR(v_ahora) >= 9 THEN
                    SET v_debe_ejecutar = TRUE;
                END IF;
            WHEN 'semanal' THEN
                IF DATEDIFF(v_ahora, v_ultima_ejecucion) >= 7 
                   AND WEEKDAY(v_ahora) = 0  -- Lunes
                   AND HOUR(v_ahora) >= 9 THEN
                    SET v_debe_ejecutar = TRUE;
                END IF;
        END CASE;
        
        -- Ejecutar procesamiento si corresponde
        IF v_debe_ejecutar THEN
            CALL sp_procesar_notificaciones_stock();
        END IF;
        
    END LOOP;
    
    CLOSE config_cursor;
END //

DELIMITER ;

-- Verificar instalación
SELECT 
    'Tabla de contactos creada' as mensaje,
    COUNT(*) as contactos_insertados
FROM notificaciones_contactos;

SELECT 
    'Configuración actualizada' as mensaje,
    COUNT(*) as configuraciones
FROM notificaciones_config;