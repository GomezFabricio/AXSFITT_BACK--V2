import ProductoService from './services/producto.service.js';
import { pool } from './db.js';

async function testSubirImagen() {
  try {
    console.log('🔄 Iniciando prueba de subida de imagen...\n');

    // Verificar que existe el producto con ID 1
    const [productos] = await pool.query('SELECT * FROM productos WHERE producto_id = 1');
    if (productos.length === 0) {
      console.log('❌ No existe el producto con ID 1');
      return;
    }

    console.log('✅ Producto encontrado:', productos[0].producto_nombre);

    // Verificar imágenes actuales
    const [imagenesActuales] = await pool.query('SELECT * FROM imagenes_productos WHERE producto_id = 1');
    console.log('📊 Imágenes actuales:', imagenesActuales.length);

    // Intentar subir una imagen
    console.log('\n🔄 Subiendo imagen...');
    const resultado = await ProductoService.subirImagenProducto(1, '/uploads/test-image-123.png');
    console.log('✅ Resultado:', resultado);

    // Verificar que se insertó
    const [imagenesPost] = await pool.query('SELECT * FROM imagenes_productos WHERE producto_id = 1');
    console.log('📊 Imágenes después:', imagenesPost.length);

    if (imagenesPost.length > imagenesActuales.length) {
      console.log('🎉 ¡Imagen insertada correctamente!');
      console.log('📄 Nueva imagen:', imagenesPost[imagenesPost.length - 1]);
    } else {
      console.log('❌ No se insertó la imagen');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    process.exit(0);
  }
}

testSubirImagen();
