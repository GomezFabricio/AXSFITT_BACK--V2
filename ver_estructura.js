import { pool } from './db.js';

async function verEstructuras() {
  try {
    console.log('📋 Columnas de tabla productos:');
    const [productosCol] = await pool.query('DESCRIBE productos');
    productosCol.forEach(col => console.log(`   - ${col.Field}`));
    
    console.log('\n📋 Columnas de tabla variantes:');
    const [variantesCol] = await pool.query('DESCRIBE variantes');
    variantesCol.forEach(col => console.log(`   - ${col.Field}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

verEstructuras();