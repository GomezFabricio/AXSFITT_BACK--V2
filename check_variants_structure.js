import { pool } from './db.js';

async function checkVariantsStructure() {
  try {
    // Estructura de valores_variantes
    const [valores] = await pool.query('DESCRIBE valores_variantes');
    console.log('Estructura valores_variantes:');
    valores.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
    
    // Estructura de atributos
    const [atributos] = await pool.query('DESCRIBE atributos');
    console.log('\nEstructura atributos:');
    atributos.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
    
    // Verificar datos de ejemplo
    const [ejemploVariante] = await pool.query(`
      SELECT v.variante_id, p.producto_nombre,
             GROUP_CONCAT(CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) SEPARATOR ', ') as variante_info
      FROM variantes v
      LEFT JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
      LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
      WHERE v.variante_id = 1
      GROUP BY v.variante_id
    `);
    
    console.log('\nEjemplo de variante ID 1:');
    console.log(ejemploVariante[0] || 'No encontrada');
    
    // Verificar conexiones
    const [conexion] = await pool.query(`
      SELECT 
        v.variante_id,
        p.producto_nombre,
        vv.valor_nombre,
        a.atributo_nombre
      FROM variantes v
      LEFT JOIN productos p ON v.producto_id = p.producto_id
      LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
      LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
      LIMIT 3
    `);
    
    console.log('\nEjemplos de conexión:');
    conexion.forEach(row => {
      console.log(`Variante ${row.variante_id}: ${row.producto_nombre} - ${row.atributo_nombre}: ${row.valor_nombre}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkVariantsStructure();