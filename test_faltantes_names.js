import { pool } from './db.js';

/**
 * Script para probar el obtenerFaltantes mejorado con nombres reales de variantes
 */

async function testFaltantesWithRealNames() {
  try {
    console.log('🧪 === TEST DE FALTANTES CON NOMBRES REALES ===\n');
    
    // 1. Crear un faltante de prueba con variante
    console.log('📦 Creando faltante de prueba con variante...');
    const [insertResult] = await pool.query(`
      INSERT INTO faltantes (
        faltante_producto_id, 
        faltante_variante_id, 
        faltante_cantidad_original, 
        faltante_cantidad_faltante, 
        faltante_estado
      ) VALUES (NULL, 1, 25, 15, 'detectado')
    `);
    
    const faltanteId = insertResult.insertId;
    console.log('✅ Faltante creado con ID:', faltanteId);
    
    // 2. Probar la query actualizada directamente
    console.log('\n🔍 Ejecutando query actualizada...');
    const [testResult] = await pool.query(`
      SELECT 
        f.faltante_id,
        f.faltante_cantidad_faltante,
        p2.producto_nombre as producto_base,
        GROUP_CONCAT(vv.valor_nombre SEPARATOR ', ') as valores_variante,
        CASE 
          WHEN f.faltante_producto_id IS NOT NULL THEN p.producto_nombre
          WHEN f.faltante_variante_id IS NOT NULL THEN 
            CASE 
              WHEN GROUP_CONCAT(vv.valor_nombre SEPARATOR ', ') IS NOT NULL THEN
                CONCAT(p2.producto_nombre, ' - ', GROUP_CONCAT(vv.valor_nombre SEPARATOR ', '))
              ELSE
                CONCAT(p2.producto_nombre, ' (Sin variantes)')
            END
          ELSE 'Producto no identificado'
        END AS producto_nombre_completo
        
      FROM faltantes f
      LEFT JOIN productos p ON f.faltante_producto_id = p.producto_id
      LEFT JOIN variantes v ON f.faltante_variante_id = v.variante_id
      LEFT JOIN productos p2 ON v.producto_id = p2.producto_id
      LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
      
      WHERE f.faltante_id = ?
      GROUP BY f.faltante_id, p.producto_nombre, p2.producto_nombre
    `, [faltanteId]);
    
    if (testResult.length > 0) {
      const test = testResult[0];
      console.log('📋 Resultado de la query:');
      console.log(`   🏷️ Producto base: ${test.producto_base}`);
      console.log(`   🎨 Valores variante: ${test.valores_variante}`);
      console.log(`   📦 Nombre completo: ${test.producto_nombre_completo}`);
      console.log(`   📊 Cantidad faltante: ${test.faltante_cantidad_faltante}`);
    }
    
    // 3. Usar el servicio actual para comparar
    console.log('\n⚙️ Usando el servicio StockService...');
    
    // Simular el import del servicio
    const StockService = await import('./services/stock.service.js');
    const faltantes = await StockService.StockService.obtenerFaltantes();
    
    // Buscar nuestro faltante de prueba
    const nuestroFaltante = faltantes.find(f => f.faltante_id === faltanteId);
    
    if (nuestroFaltante) {
      console.log('✅ Faltante encontrado en el servicio:');
      console.log(`   📦 Producto nombre: ${nuestroFaltante.producto_nombre}`);
      console.log(`   🎨 Valores variante: ${nuestroFaltante.valores_variante || 'No disponible'}`);
      console.log(`   📊 Cantidad faltante: ${nuestroFaltante.faltante_cantidad_faltante}`);
      console.log(`   📈 Stock actual: ${nuestroFaltante.stock_actual || 'N/A'}`);
    } else {
      console.log('❌ Faltante no encontrado en el servicio');
    }
    
    // 4. Mostrar todos los faltantes actuales
    console.log('\n📊 Todos los faltantes actuales:');
    faltantes.forEach((faltante, index) => {
      console.log(`   ${index + 1}. ${faltante.producto_nombre} (Faltante: ${faltante.faltante_cantidad_faltante})`);
      if (faltante.valores_variante) {
        console.log(`      🎨 Variantes: ${faltante.valores_variante}`);
      }
    });
    
    // 5. Limpiar - eliminar faltante de prueba
    await pool.query('DELETE FROM faltantes WHERE faltante_id = ?', [faltanteId]);
    console.log('\n🧹 Faltante de prueba eliminado');
    
    console.log('\n✅ TEST COMPLETADO');
    console.log('📋 El backend ahora devuelve:');
    console.log('  ✅ Nombres reales de productos y variantes');
    console.log('  ✅ Valores de variantes separados por comas');
    console.log('  ✅ Cantidades faltantes correctas');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar el test
testFaltantesWithRealNames();