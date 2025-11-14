-- ================================================================
-- TRIGGERS PARA SINCRONIZACIÓN AUTOMÁTICA DE ESTADOS DE FALTANTES
-- ================================================================

-- Crear tabla de logs para debugging de triggers
CREATE TABLE IF NOT EXISTS log_triggers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_name VARCHAR(100),
  table_affected VARCHAR(50),
  action_type VARCHAR(20),
  record_id INT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- TRIGGER 1: Actualización automática al insertar en pedidos_detalle
-- ================================================================

DELIMITER //

DROP TRIGGER IF EXISTS trg_pedidos_detalle_insert_faltantes //

CREATE TRIGGER trg_pedidos_detalle_insert_faltantes
AFTER INSERT ON pedidos_detalle
FOR EACH ROW
BEGIN
    DECLARE v_faltante_id INT DEFAULT NULL;
    DECLARE v_cantidad_faltante DECIMAL(10,2) DEFAULT 0;
    DECLARE v_nuevo_estado VARCHAR(50);
    DECLARE v_stock_actual DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_minimo DECIMAL(10,2) DEFAULT 0;
    
    -- Log del evento
    INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
    VALUES ('trg_pedidos_detalle_insert_faltantes', 'pedidos_detalle', 'INSERT', NEW.pd_id, 
            CONCAT('Procesando inserción - Producto:', COALESCE(NEW.pd_producto_id, 'NULL'), 
                   ', Variante:', COALESCE(NEW.pd_variante_id, 'NULL'), 
                   ', Cantidad:', NEW.pd_cantidad_pedida));
    
    -- Buscar faltante relacionado por variante
    IF NEW.pd_variante_id IS NOT NULL THEN
        -- Buscar faltante de variante
        SELECT f.faltante_id, f.faltante_cantidad_faltante, s.cantidad, s.stock_minimo
        INTO v_faltante_id, v_cantidad_faltante, v_stock_actual, v_stock_minimo
        FROM faltantes f
        LEFT JOIN stock s ON s.variante_id = f.faltante_variante_id
        WHERE f.faltante_variante_id = NEW.pd_variante_id 
          AND f.faltante_resuelto = FALSE
          AND f.faltante_estado IN ('detectado', 'pendiente')
        ORDER BY f.faltante_fecha_deteccion DESC
        LIMIT 1;
        
    ELSEIF NEW.pd_producto_id IS NOT NULL THEN
        -- Buscar faltante de producto
        SELECT f.faltante_id, f.faltante_cantidad_faltante, s.cantidad, s.stock_minimo
        INTO v_faltante_id, v_cantidad_faltante, v_stock_actual, v_stock_minimo
        FROM faltantes f
        LEFT JOIN stock s ON s.producto_id = f.faltante_producto_id
        WHERE f.faltante_producto_id = NEW.pd_producto_id 
          AND f.faltante_resuelto = FALSE
          AND f.faltante_estado IN ('detectado', 'pendiente')
        ORDER BY f.faltante_fecha_deteccion DESC
        LIMIT 1;
    END IF;
    
    -- Si se encontró un faltante relacionado, actualizarlo
    IF v_faltante_id IS NOT NULL THEN
        
        -- Calcular cantidad faltante real si no está definida
        IF v_cantidad_faltante IS NULL OR v_cantidad_faltante <= 0 THEN
            SET v_cantidad_faltante = GREATEST(0, COALESCE(v_stock_minimo, 0) - COALESCE(v_stock_actual, 0));
        END IF;
        
        -- Determinar nuevo estado según cantidad pedida vs faltante
        IF NEW.pd_cantidad_pedida >= v_cantidad_faltante THEN
            SET v_nuevo_estado = 'solicitado_completo';
        ELSE
            SET v_nuevo_estado = 'solicitado_parcial';
        END IF;
        
        -- Actualizar el faltante
        UPDATE faltantes 
        SET faltante_estado = v_nuevo_estado,
            faltante_cantidad_solicitada = NEW.pd_cantidad_pedida,
            faltante_pedido_id = NEW.pd_pedido_id
        WHERE faltante_id = v_faltante_id;
        
        -- Log del resultado
        INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
        VALUES ('trg_pedidos_detalle_insert_faltantes', 'faltantes', 'UPDATE', v_faltante_id,
                CONCAT('Faltante actualizado - Estado:', v_nuevo_estado, 
                       ', Cantidad pedida:', NEW.pd_cantidad_pedida,
                       ', Cantidad faltante:', v_cantidad_faltante,
                       ', Pedido ID:', NEW.pd_pedido_id));
    ELSE
        -- Log cuando no se encuentra faltante
        INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
        VALUES ('trg_pedidos_detalle_insert_faltantes', 'faltantes', 'NO_MATCH', NEW.pd_id,
                CONCAT('No se encontró faltante para - Producto:', COALESCE(NEW.pd_producto_id, 'NULL'), 
                       ', Variante:', COALESCE(NEW.pd_variante_id, 'NULL')));
    END IF;
    
END //

-- ================================================================
-- TRIGGER 2: Actualización automática al cambiar estado de pedido
-- ================================================================

DROP TRIGGER IF EXISTS trg_pedidos_update_faltantes //

CREATE TRIGGER trg_pedidos_update_faltantes
AFTER UPDATE ON pedidos
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_faltante_id INT;
    DECLARE v_producto_id INT;
    DECLARE v_variante_id INT;
    DECLARE v_nuevo_estado_faltante VARCHAR(50);
    
    -- Cursor para obtener faltantes relacionados al pedido
    DECLARE cursor_faltantes CURSOR FOR 
        SELECT f.faltante_id, f.faltante_producto_id, f.faltante_variante_id
        FROM faltantes f
        WHERE f.faltante_pedido_id = NEW.pedido_id;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Solo procesar si cambió el estado del pedido
    IF OLD.pedido_estado != NEW.pedido_estado THEN
        
        -- Log del evento
        INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
        VALUES ('trg_pedidos_update_faltantes', 'pedidos', 'UPDATE', NEW.pedido_id,
                CONCAT('Estado cambió de "', OLD.pedido_estado, '" a "', NEW.pedido_estado, '"'));
        
        -- Determinar nuevo estado para faltantes según estado del pedido
        CASE NEW.pedido_estado
            WHEN 'recibido' THEN 
                SET v_nuevo_estado_faltante = 'resuelto';
            WHEN 'recibido_parcial' THEN 
                SET v_nuevo_estado_faltante = 'resuelto_parcial';
            WHEN 'cancelado' THEN 
                SET v_nuevo_estado_faltante = 'detectado';
            ELSE 
                SET v_nuevo_estado_faltante = NULL; -- No cambiar estado
        END CASE;
        
        -- Solo proceder si hay un estado definido para los faltantes
        IF v_nuevo_estado_faltante IS NOT NULL THEN
            
            OPEN cursor_faltantes;
            read_loop: LOOP
                FETCH cursor_faltantes INTO v_faltante_id, v_producto_id, v_variante_id;
                IF done THEN
                    LEAVE read_loop;
                END IF;
                
                -- Actualizar estado del faltante
                IF v_nuevo_estado_faltante = 'resuelto' THEN
                    UPDATE faltantes 
                    SET faltante_estado = v_nuevo_estado_faltante,
                        faltante_resuelto = TRUE
                    WHERE faltante_id = v_faltante_id;
                ELSEIF v_nuevo_estado_faltante = 'detectado' THEN
                    -- Si se cancela, volver a detectado y limpiar referencias al pedido
                    UPDATE faltantes 
                    SET faltante_estado = v_nuevo_estado_faltante,
                        faltante_cantidad_solicitada = NULL,
                        faltante_pedido_id = NULL,
                        faltante_resuelto = FALSE
                    WHERE faltante_id = v_faltante_id;
                ELSE
                    UPDATE faltantes 
                    SET faltante_estado = v_nuevo_estado_faltante
                    WHERE faltante_id = v_faltante_id;
                END IF;
                
                -- Log de cada faltante actualizado
                INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
                VALUES ('trg_pedidos_update_faltantes', 'faltantes', 'UPDATE', v_faltante_id,
                        CONCAT('Faltante actualizado a estado: ', v_nuevo_estado_faltante,
                               ', Producto:', COALESCE(v_producto_id, 'NULL'),
                               ', Variante:', COALESCE(v_variante_id, 'NULL')));
                
            END LOOP;
            CLOSE cursor_faltantes;
        END IF;
    END IF;
    
END //

-- ================================================================
-- TRIGGER 3: Manejo de eliminación de items de pedidos
-- ================================================================

DROP TRIGGER IF EXISTS trg_pedidos_detalle_delete_faltantes //

CREATE TRIGGER trg_pedidos_detalle_delete_faltantes
AFTER DELETE ON pedidos_detalle
FOR EACH ROW
BEGIN
    DECLARE v_faltante_id INT DEFAULT NULL;
    
    -- Log del evento
    INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
    VALUES ('trg_pedidos_detalle_delete_faltantes', 'pedidos_detalle', 'DELETE', OLD.pd_id,
            CONCAT('Item eliminado - Producto:', COALESCE(OLD.pd_producto_id, 'NULL'), 
                   ', Variante:', COALESCE(OLD.pd_variante_id, 'NULL'),
                   ', Pedido:', OLD.pd_pedido_id));
    
    -- Buscar faltante relacionado
    IF OLD.pd_variante_id IS NOT NULL THEN
        SELECT faltante_id INTO v_faltante_id
        FROM faltantes
        WHERE faltante_variante_id = OLD.pd_variante_id 
          AND faltante_pedido_id = OLD.pd_pedido_id
        LIMIT 1;
    ELSEIF OLD.pd_producto_id IS NOT NULL THEN
        SELECT faltante_id INTO v_faltante_id
        FROM faltantes
        WHERE faltante_producto_id = OLD.pd_producto_id 
          AND faltante_pedido_id = OLD.pd_pedido_id
        LIMIT 1;
    END IF;
    
    -- Si se encontró el faltante, revertir a detectado
    IF v_faltante_id IS NOT NULL THEN
        UPDATE faltantes 
        SET faltante_estado = 'detectado',
            faltante_cantidad_solicitada = NULL,
            faltante_pedido_id = NULL
        WHERE faltante_id = v_faltante_id;
        
        -- Log del resultado
        INSERT INTO log_triggers (trigger_name, table_affected, action_type, record_id, details)
        VALUES ('trg_pedidos_detalle_delete_faltantes', 'faltantes', 'UPDATE', v_faltante_id,
                'Faltante revertido a estado "detectado" por eliminación de item del pedido');
    END IF;
    
END //

DELIMITER ;

-- ================================================================
-- VISTAS ÚTILES PARA MONITOREO
-- ================================================================

-- Vista para monitorear sincronización de faltantes
CREATE OR REPLACE VIEW vista_faltantes_sincronizacion AS
SELECT 
    f.faltante_id,
    f.faltante_estado,
    f.faltante_resuelto,
    f.faltante_cantidad_faltante,
    f.faltante_cantidad_solicitada,
    f.faltante_pedido_id,
    
    -- Información del producto/variante
    CASE 
        WHEN f.faltante_variante_id IS NOT NULL THEN 
            CONCAT((SELECT p.producto_nombre FROM variantes v JOIN productos p ON v.producto_id = p.producto_id WHERE v.variante_id = f.faltante_variante_id), ' - ', 
                   (SELECT v.variante_sku FROM variantes v WHERE v.variante_id = f.faltante_variante_id))
        WHEN f.faltante_producto_id IS NOT NULL THEN 
            (SELECT p.producto_nombre FROM productos p WHERE p.producto_id = f.faltante_producto_id)
        ELSE 'Producto no identificado'
    END AS producto_descripcion,
    
    -- Información del pedido relacionado
    p.pedido_estado,
    p.pedido_fecha_pedido,
    pr.proveedor_nombre,
    
    -- Estado de sincronización
    CASE 
        WHEN f.faltante_pedido_id IS NOT NULL AND p.pedido_id IS NULL THEN 'ERROR: Pedido no encontrado'
        WHEN f.faltante_estado = 'detectado' AND f.faltante_pedido_id IS NOT NULL THEN 'ERROR: Estado inconsistente'
        WHEN f.faltante_estado LIKE 'solicitado%' AND f.faltante_pedido_id IS NULL THEN 'ERROR: Falta referencia a pedido'
        ELSE 'OK'
    END AS estado_sincronizacion
    
FROM faltantes f
LEFT JOIN pedidos p ON f.faltante_pedido_id = p.pedido_id
LEFT JOIN proveedores pr ON p.pedido_proveedor_id = pr.proveedor_id
ORDER BY f.faltante_fecha_deteccion DESC;

-- Vista para logs de triggers recientes
CREATE OR REPLACE VIEW vista_logs_triggers_recientes AS
SELECT 
    l.*,
    TIMESTAMPDIFF(MINUTE, l.created_at, NOW()) as minutos_desde_evento
FROM log_triggers l
WHERE l.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY l.created_at DESC;

-- ================================================================
-- PROCEDIMIENTOS PARA MANTENIMIENTO
-- ================================================================

DELIMITER //

-- Procedimiento para limpiar logs antiguos
DROP PROCEDURE IF EXISTS sp_limpiar_logs_triggers //

CREATE PROCEDURE sp_limpiar_logs_triggers(IN dias_antiguedad INT)
BEGIN
    DELETE FROM log_triggers 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL dias_antiguedad DAY);
    
    SELECT ROW_COUNT() as registros_eliminados;
END //

-- Procedimiento para verificar consistencia
DROP PROCEDURE IF EXISTS sp_verificar_consistencia_faltantes //

CREATE PROCEDURE sp_verificar_consistencia_faltantes()
BEGIN
    -- Mostrar faltantes con problemas de sincronización
    SELECT 
        'Faltantes con estado inconsistente' as tipo_problema,
        COUNT(*) as cantidad
    FROM faltantes f
    LEFT JOIN pedidos p ON f.faltante_pedido_id = p.pedido_id
    WHERE (f.faltante_estado = 'detectado' AND f.faltante_pedido_id IS NOT NULL)
       OR (f.faltante_estado LIKE 'solicitado%' AND f.faltante_pedido_id IS NULL)
       OR (f.faltante_pedido_id IS NOT NULL AND p.pedido_id IS NULL)
    
    UNION ALL
    
    SELECT 
        'Faltantes en estado resuelto pero no marcados como resueltos' as tipo_problema,
        COUNT(*) as cantidad
    FROM faltantes f
    WHERE f.faltante_estado = 'resuelto' AND f.faltante_resuelto = FALSE
    
    UNION ALL
    
    SELECT 
        'Total de faltantes activos' as tipo_problema,
        COUNT(*) as cantidad
    FROM faltantes f
    WHERE f.faltante_resuelto = FALSE;
    
END //

DELIMITER ;

-- Mensaje de confirmación
SELECT 'Triggers de sincronización de faltantes creados exitosamente' as mensaje,
       NOW() as fecha_creacion;

-- Mostrar triggers creados
SHOW TRIGGERS WHERE `Trigger` LIKE '%faltantes%';