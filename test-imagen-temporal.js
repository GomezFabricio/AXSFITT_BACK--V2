import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4000/api/productos-v2';

// Token de ejemplo - necesitarás usar un token real
const TOKEN = 'tu-token-aqui';

async function testImagenTemporal() {
  console.log('🧪 Iniciando test de imagen temporal...');
  
  try {
    // Crear un FormData
    const formData = new FormData();
    
    // Agregar datos de prueba
    formData.append('usuario_id', '1');
    formData.append('imagen_orden', '0');
    
    // Para testing necesitarías un archivo real
    console.log('⚠️  Para un test completo, necesitas agregar un archivo real');
    console.log('📝 Endpoint disponible:', `${BASE_URL}/imagenes-temporales`);
    console.log('📝 Método: POST');
    console.log('📝 Headers requeridos: Authorization, Content-Type: multipart/form-data');
    console.log('📝 Campos requeridos: file, usuario_id, imagen_orden');
    
  } catch (error) {
    console.error('❌ Error en el test:', error.message);
  }
}

// Ejecutar el test
testImagenTemporal();
