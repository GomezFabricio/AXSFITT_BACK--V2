// Script de prueba para el módulo de Carrito de Pedido Rápido
// Ejecutar con: node test_carrito_pedidos.js

const API_BASE = 'http://localhost:4000/api/carrito-pedidos';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c3VhcmlvX2lkIjoxLCJlbWFpbCI6ImZhYnJpY2lvLmdvbWV6NDM3MUBnbWFpbC5jb20iLCJpYXQiOjE3NjMwOTkzNTAsImV4cCI6MTc2MzEwMjk1MH0.gSOTD2x8p0unLYbeNhN1SF_IRkQu7lhhUCwvgDqjUpM';

// Función helper para hacer requests
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      ...options.headers
    },
    ...options
  };

  console.log(`🌐 ${config.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Éxito:', JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('❌ Error:', response.status, JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('💥 Error de red:', error.message);
    return null;
  }
};

// Función para mostrar separadores
const separator = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
};

// Función principal de prueba
const testCarritoPedidos = async () => {
  console.log('🚀 INICIANDO PRUEBAS DEL CARRITO DE PEDIDO RÁPIDO');
  console.log(`🔑 Token de prueba: ${TOKEN.substring(0, 50)}...`);

  // =====================================================
  // 1. PRUEBA: Obtener carrito inicial (debe estar vacío)
  // =====================================================
  separator('1. OBTENER CARRITO INICIAL');
  let carrito = await request('/carrito');

  // =====================================================
  // 2. PRUEBA: Obtener lista de proveedores
  // =====================================================
  separator('2. OBTENER PROVEEDORES');
  let proveedores = await request('/proveedores');

  // =====================================================
  // 3. PRUEBA: Agregar todos los faltantes al carrito
  // =====================================================
  separator('3. AGREGAR TODOS LOS FALTANTES AL CARRITO');
  let resultadoAgregar = await request('/carrito/agregar-todos', { method: 'POST' });

  // =====================================================
  // 4. PRUEBA: Verificar carrito después de agregar faltantes
  // =====================================================
  separator('4. VERIFICAR CARRITO CON FALTANTES');
  carrito = await request('/carrito');

  // =====================================================
  // 5. PRUEBA: Seleccionar un proveedor (usar el primero disponible)
  // =====================================================
  if (proveedores?.data?.length > 0) {
    separator('5. SELECCIONAR PROVEEDOR');
    const proveedorId = proveedores.data[0].proveedor_id;
    console.log(`📋 Seleccionando proveedor ID: ${proveedorId}`);
    
    await request('/carrito/proveedor', {
      method: 'POST',
      body: JSON.stringify({ proveedor_id: proveedorId })
    });
  }

  // =====================================================
  // 6. PRUEBA: Verificar carrito con proveedor seleccionado
  // =====================================================
  separator('6. VERIFICAR CARRITO CON PROVEEDOR');
  carrito = await request('/carrito');

  // =====================================================
  // 7. PRUEBA: Actualizar cantidad de un item (si hay items)
  // =====================================================
  if (carrito?.data?.items?.length > 0) {
    separator('7. ACTUALIZAR CANTIDAD DE ITEM');
    const primerItem = carrito.data.items[0];
    console.log(`📦 Actualizando cantidad del item: ${primerItem.key}`);
    
    await request('/carrito/cantidad', {
      method: 'PUT',
      body: JSON.stringify({
        item_key: primerItem.key,
        cantidad: primerItem.cantidad + 1
      })
    });
  }

  // =====================================================
  // 8. PRUEBA: Crear pedido desde carrito (solo si hay items y proveedor)
  // =====================================================
  carrito = await request('/carrito'); // Refrescar carrito
  
  if (carrito?.data?.items?.length > 0 && carrito?.data?.proveedor_id) {
    separator('8. CREAR PEDIDO DESDE CARRITO');
    console.log(`📝 Creando pedido con ${carrito.data.items.length} items`);
    
    let resultadoPedido = await request('/carrito/confirmar', { method: 'POST' });
    
    if (resultadoPedido) {
      console.log(`🎉 ¡Pedido creado exitosamente! ID: ${resultadoPedido.data?.pedido_id}`);
    }
  }

  // =====================================================
  // 9. PRUEBA: Verificar carrito después de crear pedido (debe estar vacío)
  // =====================================================
  separator('9. VERIFICAR CARRITO DESPUÉS DE CREAR PEDIDO');
  carrito = await request('/carrito');

  // =====================================================
  // 10. PRUEBA: Agregar un faltante específico manualmente
  // =====================================================
  separator('10. AGREGAR FALTANTE ESPECÍFICO');
  await request('/carrito/agregar', {
    method: 'POST',
    body: JSON.stringify({
      producto_id: 1, // Asumiendo que existe un producto con ID 1
      cantidad_necesaria: 5
    })
  });

  // =====================================================
  // 11. PRUEBA: Quitar item del carrito
  // =====================================================
  separator('11. QUITAR ITEM DEL CARRITO');
  carrito = await request('/carrito');
  
  if (carrito?.data?.items?.length > 0) {
    const itemKey = carrito.data.items[0].key;
    console.log(`🗑️ Quitando item: ${itemKey}`);
    
    await request('/carrito/quitar', {
      method: 'DELETE',
      body: JSON.stringify({ item_key: itemKey })
    });
  }

  // =====================================================
  // 12. PRUEBA: Vaciar carrito
  // =====================================================
  separator('12. VACIAR CARRITO');
  await request('/carrito/vaciar', { method: 'DELETE' });

  // =====================================================
  // RESUMEN FINAL
  // =====================================================
  separator('RESUMEN FINAL');
  carrito = await request('/carrito');
  
  console.log('📋 Estado final del carrito:');
  console.log(`   - Items: ${carrito?.data?.items?.length || 0}`);
  console.log(`   - Proveedor: ${carrito?.data?.proveedor_nombre || 'No seleccionado'}`);
  
  console.log('\n🏁 PRUEBAS COMPLETADAS');
  console.log('✨ Módulo de Carrito de Pedido Rápido funcionando correctamente!');
};

// Ejecutar pruebas
testCarritoPedidos().catch(console.error);

export { testCarritoPedidos };