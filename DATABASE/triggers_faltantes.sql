-- =============================================
-- TRIGGERS PARA GESTIÓN AUTOMÁTICA DE FALTANTES
-- =============================================

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trg_detectar_faltante_insert;
DROP TRIGGER IF EXISTS trg_detectar_faltante_update;
DROP TRIGGER IF EXISTS trg_resolver_faltante_stock_update;
DROP TRIGGER IF EXISTS trg_restaurar_faltante_pedido_delete;

DELIMITER $$

-- =============================================
-- TRIGGER 1: Detectar faltantes en INSERT de stock
-- =============================================
CREATE TRIGGER trg_detectar_faltante_insert
AFTER INSERT ON stock
FOR EACH ROW
BEGIN
    -- Verificar si el stock está por debajo del mínimo
    IF NEW.cantidad < NEW.stock_minimo THEN
        -- Verificar que no exista ya un faltante activo para este producto/variante
        IF NOT EXISTS (
            SELECT 1 FROM faltantes 
            WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
            AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo', 'pedido_generado', 'en_transito')
        ) THEN
            -- Insertar el faltante
            INSERT INTO faltantes (
                faltante_producto_id,
                faltante_variante_id,
                faltante_cantidad_original,
                faltante_cantidad_faltante,
                faltante_estado
            ) VALUES (
                NEW.producto_id,
                NEW.variante_id,
                NEW.cantidad,
                NEW.stock_minimo - NEW.cantidad,
                'detectado'
            );
        END IF;
    END IF;
END$$

-- =============================================
-- TRIGGER 2: Detectar faltantes en UPDATE de stock
-- =============================================
CREATE TRIGGER trg_detectar_faltante_update
AFTER UPDATE ON stock
FOR EACH ROW
BEGIN
    -- Verificar si el stock bajó por debajo del mínimo
    IF NEW.cantidad < NEW.stock_minimo AND OLD.cantidad >= OLD.stock_minimo THEN
        -- Verificar que no exista ya un faltante activo para este producto/variante
        IF NOT EXISTS (
            SELECT 1 FROM faltantes 
            WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
            AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo', 'pedido_generado', 'en_transito')
        ) THEN
            -- Insertar el faltante
            INSERT INTO faltantes (
                faltante_producto_id,
                faltante_variante_id,
                faltante_cantidad_original,
                faltante_cantidad_faltante,
                faltante_estado
            ) VALUES (
                NEW.producto_id,
                NEW.variante_id,
                NEW.cantidad,
                NEW.stock_minimo - NEW.cantidad,
                'detectado'
            );
        END IF;
    END IF;
END$$

-- =============================================
-- TRIGGER 3: Resolver faltante cuando stock supera mínimo
-- =============================================
CREATE TRIGGER trg_resolver_faltante_stock_update
AFTER UPDATE ON stock
FOR EACH ROW
BEGIN
    -- Si el stock ahora está por encima del mínimo
    IF NEW.cantidad >= NEW.stock_minimo AND OLD.cantidad < OLD.stock_minimo THEN
        -- Marcar como resueltos los faltantes activos de este producto/variante
        UPDATE faltantes 
        SET faltante_estado = 'resuelto', 
            faltante_resuelto = 1
        WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
        AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo');
    END IF;
END$$

-- =============================================
-- TRIGGER 4: Restaurar faltante cuando se elimina de pedido
-- =============================================
CREATE TRIGGER trg_restaurar_faltante_pedido_delete
AFTER DELETE ON pedidos_detalle
FOR EACH ROW
BEGIN
    -- Verificar si existe un faltante con estado 'pedido_generado' para este producto/variante
    IF EXISTS (
        SELECT 1 FROM faltantes 
        WHERE (faltante_producto_id = OLD.pd_producto_id OR faltante_variante_id = OLD.pd_variante_id)
        AND faltante_estado IN ('pedido_generado', 'en_transito')
    ) THEN
        -- Verificar el stock actual para determinar si aún hay faltante
        IF EXISTS (
            SELECT 1 FROM stock s
            WHERE (s.producto_id = OLD.pd_producto_id OR s.variante_id = OLD.pd_variante_id)
            AND s.cantidad < s.stock_minimo
        ) THEN
            -- Restaurar el estado a 'detectado'
            UPDATE faltantes 
            SET faltante_estado = 'detectado'
            WHERE (faltante_producto_id = OLD.pd_producto_id OR faltante_variante_id = OLD.pd_variante_id)
            AND faltante_estado IN ('pedido_generado', 'en_transito');
        ELSE
            -- Si ya no hay faltante, marcar como resuelto
            UPDATE faltantes 
            SET faltante_estado = 'resuelto', 
                faltante_resuelto = 1
            WHERE (faltante_producto_id = OLD.pd_producto_id OR faltante_variante_id = OLD.pd_variante_id)
            AND faltante_estado IN ('pedido_generado', 'en_transito');
        END IF;
    END IF;
END$$

-- =============================================
-- TRIGGER 5: Resolver faltantes al recepcionar pedidos (stock_movimientos)
-- =============================================
CREATE TRIGGER trg_resolver_faltante_recepcion
AFTER INSERT ON stock_movimientos
FOR EACH ROW
BEGIN
    -- Si es un movimiento de entrada por recepción de pedido
    IF NEW.sm_tipo_movimiento = 'entrada' AND NEW.sm_pedido_id IS NOT NULL THEN
        -- Verificar el stock actual después del movimiento
        SET @stock_actual = (
            SELECT cantidad 
            FROM stock 
            WHERE (producto_id = NEW.sm_producto_id OR variante_id = NEW.sm_variante_id)
            LIMIT 1
        );
        
        SET @stock_minimo = (
            SELECT stock_minimo 
            FROM stock 
            WHERE (producto_id = NEW.sm_producto_id OR variante_id = NEW.sm_variante_id)
            LIMIT 1
        );
        
        -- Si el stock actual es >= stock mínimo, resolver faltantes
        IF @stock_actual >= @stock_minimo THEN
            UPDATE faltantes 
            SET faltante_estado = 'resuelto', 
                faltante_resuelto = 1
            WHERE (faltante_producto_id = NEW.sm_producto_id OR faltante_variante_id = NEW.sm_variante_id)
            AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo', 'pedido_generado', 'en_transito');
        END IF;
    END IF;
END$$

DELIMITER ;

-- =============================================
-- PROCEDIMIENTO: Verificar y sincronizar faltantes existentes
-- =============================================
DELIMITER $$

CREATE PROCEDURE sp_sincronizar_faltantes()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_stock_id INT;
    DECLARE v_producto_id INT;
    DECLARE v_variante_id INT;
    DECLARE v_cantidad INT;
    DECLARE v_stock_minimo INT;
    
    -- Cursor para recorrer todos los stocks
    DECLARE stock_cursor CURSOR FOR
        SELECT stock_id, producto_id, variante_id, cantidad, stock_minimo
        FROM stock
        WHERE cantidad < stock_minimo;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Abrir cursor
    OPEN stock_cursor;
    
    -- Loop através de los registros
    stock_loop: LOOP
        FETCH stock_cursor INTO v_stock_id, v_producto_id, v_variante_id, v_cantidad, v_stock_minimo;
        
        IF done THEN
            LEAVE stock_loop;
        END IF;
        
        -- Verificar que no exista ya un faltante activo
        IF NOT EXISTS (
            SELECT 1 FROM faltantes 
            WHERE (faltante_producto_id = v_producto_id OR faltante_variante_id = v_variante_id)
            AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo', 'pedido_generado', 'en_transito')
        ) THEN
            -- Insertar el faltante
            INSERT INTO faltantes (
                faltante_producto_id,
                faltante_variante_id,
                faltante_cantidad_original,
                faltante_cantidad_faltante,
                faltante_estado
            ) VALUES (
                v_producto_id,
                v_variante_id,
                v_cantidad,
                v_stock_minimo - v_cantidad,
                'detectado'
            );
        END IF;
        
    END LOOP;
    
    -- Cerrar cursor
    CLOSE stock_cursor;
    
    SELECT 'Sincronización de faltantes completada' as mensaje;
END$$

DELIMITER ;