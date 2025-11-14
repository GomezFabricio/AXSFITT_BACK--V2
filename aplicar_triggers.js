import { pool } from './db.js';
import fs from 'fs/promises';

async function aplicarTriggers() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Aplicando triggers de sincronización de faltantes...\n');
    
    // Leer el archivo SQL
    const sqlContent = await fs.readFile('./database/triggers_sincronizacion_faltantes.sql', 'utf-8');
    
    // Ejecutar los comandos de DROP TRIGGER primero
    const dropCommands = [
      'DROP TRIGGER IF EXISTS trg_pedidos_detalle_insert_faltantes',
      'DROP TRIGGER IF EXISTS trg_pedidos_detalle_update_faltantes', 
      'DROP TRIGGER IF EXISTS trg_pedidos_detalle_delete_faltantes',
      'DROP TRIGGER IF EXISTS trg_pedidos_update_faltantes'
    ];
    
    console.log('🗑️ Eliminando triggers existentes...');
    for (const cmd of dropCommands) {
      try {
        await connection.query(cmd);
        console.log(`✅ ${cmd}`);
      } catch (error) {
        console.log(`⚠️ ${cmd} - ${error.message}`);
      }
    }
    
    // Crear tabla de logs si no existe
    console.log('\n📋 Creando tabla de logs...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS log_triggers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tabla VARCHAR(50) NOT NULL,
        accion VARCHAR(50) NOT NULL,
        detalles TEXT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla log_triggers creada/verificada');
    
    // Crear los triggers nuevos
    console.log('\n🔨 Creando nuevos triggers...');
    
    const triggers = [
      {
        name: 'trg_pedidos_detalle_insert_faltantes',
        sql: `
        CREATE TRIGGER trg_pedidos_detalle_insert_faltantes
        AFTER INSERT ON pedidos_detalle
        FOR EACH ROW
        BEGIN
            DECLARE done INT DEFAULT FALSE;
            DECLARE v_faltante_id INT;
            DECLARE v_cantidad_faltante INT;
            DECLARE v_cantidad_solicitada_actual INT;
            DECLARE nueva_cantidad_solicitada INT;
            DECLARE nuevo_estado VARCHAR(50);
            
            -- Cursor para encontrar faltantes relacionados al detalle insertado
            DECLARE cur_faltantes CURSOR FOR
                SELECT 
                    faltante_id, 
                    faltante_cantidad_faltante, 
                    faltante_cantidad_solicitada
                FROM faltantes 
                WHERE faltante_estado IN ('detectado', 'solicitado_parcial')
                  AND (
                    (NEW.pd_producto_id IS NOT NULL AND faltante_producto_id = NEW.pd_producto_id) 
                    OR 
                    (NEW.pd_variante_id IS NOT NULL AND faltante_variante_id = NEW.pd_variante_id)
                  );
            
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
            
            -- Log del inicio del trigger
            INSERT INTO log_triggers (tabla, accion, detalles, fecha) 
            VALUES ('pedidos_detalle', 'INSERT', 
                    CONCAT('Procesando detalle pedido ID: ', NEW.pd_id, 
                           ' - Producto: ', IFNULL(NEW.pd_producto_id, 'N/A'), 
                           ' - Variante: ', IFNULL(NEW.pd_variante_id, 'N/A'),
                           ' - Cantidad: ', NEW.pd_cantidad_pedida), 
                    NOW());
            
            -- Abrir cursor y procesar faltantes
            OPEN cur_faltantes;
            
            read_loop: LOOP
                FETCH cur_faltantes INTO v_faltante_id, v_cantidad_faltante, v_cantidad_solicitada_actual;
                
                IF done THEN
                    LEAVE read_loop;
                END IF;
                
                -- Calcular nueva cantidad solicitada
                SET nueva_cantidad_solicitada = v_cantidad_solicitada_actual + NEW.pd_cantidad_pedida;
                
                -- Determinar nuevo estado
                IF nueva_cantidad_solicitada >= v_cantidad_faltante THEN
                    SET nuevo_estado = 'solicitado_completo';
                ELSE
                    SET nuevo_estado = 'solicitado_parcial';
                END IF;
                
                -- Actualizar faltante
                UPDATE faltantes 
                SET 
                    faltante_estado = nuevo_estado,
                    faltante_cantidad_solicitada = nueva_cantidad_solicitada,
                    faltante_pedido_id = NEW.pd_pedido_id
                WHERE faltante_id = v_faltante_id;
                
                -- Log de la actualización
                INSERT INTO log_triggers (tabla, accion, detalles, fecha) 
                VALUES ('faltantes', 'UPDATE_FROM_PEDIDO_INSERT', 
                        CONCAT('Faltante ID: ', v_faltante_id, 
                               ' actualizado a estado: ', nuevo_estado,
                               ' - Cantidad solicitada: ', nueva_cantidad_solicitada, '/', v_cantidad_faltante), 
                        NOW());
                
            END LOOP;
            
            CLOSE cur_faltantes;
        END`
      },
      {
        name: 'trg_pedidos_update_faltantes',
        sql: `
        CREATE TRIGGER trg_pedidos_update_faltantes
        AFTER UPDATE ON pedidos
        FOR EACH ROW
        BEGIN
            -- Solo procesar si cambió el estado del pedido
            IF OLD.pedido_estado != NEW.pedido_estado THEN
                
                INSERT INTO log_triggers (tabla, accion, detalles, fecha) 
                VALUES ('pedidos', 'UPDATE_ESTADO', 
                        CONCAT('Pedido ID: ', NEW.pedido_id, 
                               ' cambió de estado: ', OLD.pedido_estado, ' -> ', NEW.pedido_estado), 
                        NOW());
                
                -- Si el pedido fue cancelado, volver faltantes a estado detectado
                IF NEW.pedido_estado = 'cancelado' THEN
                    
                    UPDATE faltantes 
                    SET 
                        faltante_estado = 'detectado',
                        faltante_cantidad_solicitada = 0,
                        faltante_pedido_id = NULL
                    WHERE faltante_pedido_id = NEW.pedido_id;
                    
                -- Si el pedido fue completado, marcar faltantes como resueltos
                ELSEIF NEW.pedido_estado = 'completo' THEN
                    
                    UPDATE faltantes 
                    SET 
                        faltante_estado = 'resuelto',
                        faltante_resuelto = 1
                    WHERE faltante_pedido_id = NEW.pedido_id;
                    
                END IF;
                
            END IF;
        END`
      }
    ];
    
    for (const trigger of triggers) {
      try {
        await connection.query(trigger.sql);
        console.log(`✅ ${trigger.name} creado exitosamente`);
      } catch (error) {
        console.log(`❌ Error creando ${trigger.name}:`, error.message);
      }
    }
    
    // Verificar triggers creados
    console.log('\n🔍 Verificando triggers creados...');
    const [triggers_result] = await connection.query(`
      SHOW TRIGGERS 
      WHERE \`Trigger\` LIKE '%faltante%' 
         OR \`Trigger\` LIKE '%pedido%'
    `);
    
    console.log(`✅ Total de triggers relacionados: ${triggers_result.length}`);
    triggers_result.forEach(t => {
      console.log(`   - ${t.Trigger} en tabla ${t.Table} (${t.Event} ${t.Timing})`);
    });
    
    console.log('\n🎉 Triggers de sincronización aplicados exitosamente!');
    console.log('\n📝 Los triggers se activarán automáticamente cuando:');
    console.log('   - Se inserte un detalle de pedido');
    console.log('   - Se cambie el estado de un pedido');
    console.log('   - Esto actualizará automáticamente los estados de faltantes');
    
  } catch (error) {
    console.error('❌ Error aplicando triggers:', error);
  } finally {
    connection.release();
    pool.end();
  }
}

aplicarTriggers();