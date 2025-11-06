import { pool } from './db.js';

async function configurarSistema() {
  try {
    console.log('🔧 Configurando sistema de faltantes...');
    
    // 1. Eliminar triggers existentes si existen
    console.log('🗑️ Limpiando triggers anteriores...');
    const dropsQuery = `
      DROP TRIGGER IF EXISTS trg_detectar_faltante_insert;
      DROP TRIGGER IF EXISTS trg_detectar_faltante_update;
      DROP TRIGGER IF EXISTS trg_resolver_faltante_stock_update;
      DROP TRIGGER IF EXISTS trg_restaurar_faltante_pedido_delete;
      DROP TRIGGER IF EXISTS trg_resolver_faltante_recepcion;
    `;
    
    const drops = dropsQuery.split(';').filter(q => q.trim());
    for (const drop of drops) {
      try {
        await pool.query(drop.trim());
      } catch (e) { /* ignorar errores */ }
    }
    
    // 2. Crear triggers básicos
    console.log('📋 Creando triggers de detección...');
    
    await pool.query(`
      CREATE TRIGGER trg_detectar_faltante_update
      AFTER UPDATE ON stock
      FOR EACH ROW
      BEGIN
          IF NEW.cantidad < NEW.stock_minimo AND OLD.cantidad >= OLD.stock_minimo THEN
              IF NOT EXISTS (
                  SELECT 1 FROM faltantes 
                  WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
                  AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo', 'pedido_generado', 'en_transito')
              ) THEN
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
      END
    `);
    
    await pool.query(`
      CREATE TRIGGER trg_resolver_faltante_stock_update
      AFTER UPDATE ON stock
      FOR EACH ROW
      BEGIN
          IF NEW.cantidad >= NEW.stock_minimo AND OLD.cantidad < OLD.stock_minimo THEN
              UPDATE faltantes 
              SET faltante_estado = 'resuelto', 
                  faltante_resuelto = 1
              WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
              AND faltante_estado IN ('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo');
          END IF;
      END
    `);
    
    console.log('✅ Triggers creados');
    
    // 3. Crear tabla de configuración de notificaciones
    console.log('📧 Configurando notificaciones...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones_config (
        config_id int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
        config_tipo enum('email','whatsapp','sms') NOT NULL,
        config_activo tinyint(1) DEFAULT 1,
        config_destinatarios json NOT NULL,
        config_template text DEFAULT NULL,
        config_umbral_notificacion int(10) UNSIGNED DEFAULT 1,
        config_frecuencia_horas int(10) UNSIGNED DEFAULT 24,
        config_fecha_creacion timestamp NOT NULL DEFAULT current_timestamp(),
        config_fecha_actualizacion timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (config_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    
    // 4. Insertar configuración básica
    await pool.query(`
      INSERT IGNORE INTO notificaciones_config (
        config_tipo,
        config_activo,
        config_destinatarios,
        config_template,
        config_umbral_notificacion,
        config_frecuencia_horas
      ) VALUES (
        'email',
        1,
        JSON_ARRAY('cp15414621@gmail.com'),
        '🚨 ALERTA DE STOCK BAJO - AXSFITT\\n\\nSe han detectado productos con stock por debajo del mínimo.\\n\\nPor favor, revise el sistema y genere los pedidos correspondientes.',
        1,
        6
      )
    `);
    
    console.log('✅ Notificaciones configuradas');
    
    // 5. Verificar estado actual
    const [faltantes] = await pool.query(`
      SELECT COUNT(*) as total FROM faltantes WHERE faltante_estado = 'detectado'
    `);
    
    const [config] = await pool.query(`
      SELECT * FROM notificaciones_config WHERE config_tipo = 'email'
    `);
    
    console.log('🎉 ¡Configuración completada!');
    console.log(`📊 Faltantes detectados: ${faltantes[0].total}`);
    console.log(`📧 Email configurado: ${config[0]?.config_activo ? 'ACTIVO' : 'INACTIVO'}`);
    console.log(`👤 Destinatario: cp15414621@gmail.com`);
    
    pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    pool.end();
  }
}

configurarSistema();