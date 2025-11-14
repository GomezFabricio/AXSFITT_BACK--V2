import { pool } from './db.js';

async function checkStructure() {
  try {
    // Verificar tablas disponibles
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Tablas disponibles:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`- ${tableName}`);
    });
    
    // Verificar estructura de variantes si existe
    const hasVariantes = tables.some(table => Object.values(table)[0] === 'variantes');
    if (hasVariantes) {
      console.log('\nEstructura de tabla variantes:');
      const [variantesStructure] = await pool.query('DESCRIBE variantes');
      variantesStructure.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
    } else {
      console.log('\n❌ Tabla variantes no encontrada');
    }
    
    // Verificar estructura de productos
    console.log('\nEstructura de tabla productos:');
    const [productosStructure] = await pool.query('DESCRIBE productos');
    productosStructure.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
    
    // Verificar si existe alguna tabla de atributos o valores
    const attributesTables = tables.filter(table => {
      const tableName = Object.values(table)[0];
      return tableName.includes('atributo') || tableName.includes('valor') || tableName.includes('variante');
    });
    
    console.log('\nTablas relacionadas con variantes/atributos:');
    attributesTables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`- ${tableName}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStructure();