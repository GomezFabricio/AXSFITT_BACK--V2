import ProductoService from '../services/producto.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { Validador } from '../utils/validador.js';
import fs from 'fs';
import path from 'path';

/**
 * Controlador refactorizado para productos
 * Maneja las peticiones HTTP y delega la lógica de negocio al servicio
 * Mantiene la compatibilidad con la estructura de respuesta original
 */
class ProductoController {
  /**
   * Obtiene todos los productos
   */
  static async obtenerProductos(req, res) {
    try {
      const { estado } = req.query; // Obtener el estado desde la query como en el controlador original
      
      const productos = await ProductoService.obtenerTodosLosProductos(estado);
      
      // Devolver directamente el array de productos como en el controlador original
      res.status(200).json(productos);
    } catch (error) {
      console.error('Error al obtener productos:', error);
      res.status(500).json({ message: 'Error interno al obtener productos.' });
    }
  }

  /**
   * Obtiene un producto por ID
   */
  static async obtenerProductoPorId(req, res) {
    try {
      const { producto_id } = req.params;

      // Validar que el ID sea un número válido
      if (!Validador.esNumeroValido(producto_id)) {
        return res.status(400).json({ message: 'ID de producto inválido.' });
      }

      const producto = await ProductoService.obtenerProductoPorId(producto_id);

      if (!producto) {
        return res.status(404).json({ message: 'Producto no encontrado.' });
      }

      // Devolver con la misma estructura que el controlador original
      res.status(200).json(producto);
    } catch (error) {
      console.error('Error al obtener producto:', error);
      res.status(500).json({ message: 'Error interno al obtener el producto.' });
    }
  }

  /**
   * Busca productos por nombre
   */
  static async buscarProductosPorNombre(req, res) {
    try {
      const { nombre, categoria_id } = req.query;

      if (!nombre || nombre.trim().length < 2) {
        return res.status(400).json({ message: 'El nombre debe tener al menos 2 caracteres.' });
      }

      const productos = await ProductoService.buscarProductosPorNombre(nombre.trim(), categoria_id);
      
      // Devolver directamente el array de productos
      res.status(200).json(productos);
    } catch (error) {
      console.error('Error al buscar productos:', error);
      res.status(500).json({ message: 'Error interno al buscar productos.' });
    }
  }

  /**
   * Obtiene imágenes temporales de un usuario
   */
  static async obtenerImagenesTemporales(req, res) {
    try {
      const { usuario_id } = req.params;

      if (!Validador.esNumeroValido(usuario_id)) {
        return ApiResponse.error(res, 'ID de usuario inválido', 400);
      }

      const imagenes = await ProductoService.obtenerImagenesTemporales(usuario_id);
      
      return ApiResponse.success(res, imagenes, 'Imágenes temporales obtenidas exitosamente');
    } catch (error) {
      console.error('Error al obtener imágenes temporales:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  /**
   * Obtiene detalles de stock de un producto
   */
  static async obtenerDetallesStock(req, res) {
    try {
      const { producto_id } = req.params;

      if (!Validador.esNumeroValido(producto_id)) {
        return res.status(400).json({ message: 'ID de producto inválido.' });
      }

      const stock = await ProductoService.obtenerDetallesStock(producto_id);
      
      // Devolver directamente los datos de stock
      res.status(200).json(stock);
    } catch (error) {
      console.error('Error al obtener detalles de stock:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }

  /**
   * Las demás funciones mantienen ApiResponse por ser operaciones que no devuelven datos complejos
   */
  
  /**
   * Crea un nuevo producto
   */
  static async crearProducto(req, res) {
    try {
      const datosProducto = req.body;
      
      // Validaciones básicas
      if (!Validador.esTextoValido(datosProducto.producto_nombre)) {
        return ApiResponse.error(res, 'El nombre del producto es obligatorio', 400);
      }
      
      if (!Validador.esNumeroValido(datosProducto.categoria_id)) {
        return ApiResponse.error(res, 'La categoría es obligatoria', 400);
      }

      const nuevoProducto = await ProductoService.crearProducto(datosProducto);
      
      return ApiResponse.success(res, nuevoProducto, 'Producto creado exitosamente', 201);
    } catch (error) {
      console.error('❌ Error al crear producto:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Manejo de errores específicos
      if (error.message.includes('nombre')) {
        return ApiResponse.error(res, 'Ya existe un producto con ese nombre en la misma categoría', 409);
      }
      
      if (error.message.includes('SKU')) {
        return ApiResponse.error(res, 'Ya existe un producto con ese SKU', 409);
      }
      
      if (error.code === 'ER_DUP_ENTRY') {
        return ApiResponse.error(res, 'Ya existe un producto con esos datos', 409);
      }
      
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  /**
   * Actualiza un producto existente
   */
  static async actualizarProducto(req, res) {
    try {
      const { producto_id } = req.params;
      const datosProducto = req.body;
      
      if (!Validador.esNumeroValido(producto_id)) {
        return ApiResponse.error(res, 'ID de producto inválido', 400);
      }

      const productoActualizado = await ProductoService.actualizarProductoCompleto(producto_id, datosProducto);
      
      return ApiResponse.success(res, { producto_id }, 'Producto actualizado exitosamente');
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  /**
   * Elimina un producto
   */
  static async eliminarProducto(req, res) {
    try {
      const { producto_id } = req.params;
      
      if (!Validador.esNumeroValido(producto_id)) {
        return ApiResponse.error(res, 'ID de producto inválido', 400);
      }

      const resultado = await ProductoService.eliminarProducto(producto_id);
      
      return ApiResponse.success(res, { producto_id }, 'Producto eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  /**
   * Verifica si un nombre de producto está duplicado
   */
  static async verificarNombreDuplicado(req, res) {
    try {
      const { nombre, categoria_id, producto_id } = req.query;

      if (!nombre || !categoria_id) {
        return ApiResponse.error(res, 'Nombre y categoría son obligatorios', 400);
      }

      const isDuplicado = await ProductoService.verificarNombreDuplicado(nombre, categoria_id, producto_id);
      
      return ApiResponse.success(res, { 
        duplicado: isDuplicado,
        nombre,
        categoria_id 
      }, 'Verificación completada');
    } catch (error) {
      console.error('Error al verificar nombre duplicado:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  /**
   * Verifica si un SKU está duplicado
   */
  static async verificarSkuDuplicado(req, res) {
    try {
      const { sku, producto_id } = req.query;

      if (!sku) {
        return ApiResponse.error(res, 'SKU es obligatorio', 400);
      }

      const isDuplicado = await ProductoService.verificarSkuDuplicado(sku, producto_id);
      
      return ApiResponse.success(res, { 
        duplicado: isDuplicado,
        sku 
      }, 'Verificación completada');
    } catch (error) {
      console.error('Error al verificar SKU duplicado:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  // Otras funciones que mantienen ApiResponse...
  static async cambiarVisibilidad(req, res) {
    try {
      const { producto_id } = req.params;
      const { visible } = req.body;
      
      if (!Validador.esNumeroValido(producto_id)) {
        return ApiResponse.error(res, 'ID de producto inválido', 400);
      }

      await ProductoService.cambiarVisibilidad(producto_id, visible);
      
      return ApiResponse.success(res, { producto_id, visible }, 'Visibilidad actualizada exitosamente');
    } catch (error) {
      console.error('Error al cambiar visibilidad:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async reactivarProducto(req, res) {
    try {
      const { producto_id } = req.params;
      
      if (!Validador.esNumeroValido(producto_id)) {
        return ApiResponse.error(res, 'ID de producto inválido', 400);
      }

      await ProductoService.reactivarProducto(producto_id);
      
      return ApiResponse.success(res, { producto_id }, 'Producto reactivado exitosamente');
    } catch (error) {
      console.error('Error al reactivar producto:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async guardarImagenTemporal(req, res) {
    try {
      const { usuario_id, imagen_orden } = req.body;
      const archivo = req.file;

      if (!archivo) {
        return ApiResponse.error(res, 'No se recibió ningún archivo', 400);
      }

      if (!usuario_id) {
        return ApiResponse.error(res, 'ID de usuario es requerido', 400);
      }
      
      // Crear la URL de la imagen
      const imagen_url = `/uploads/${archivo.filename}`;
      
      const resultado = await ProductoService.guardarImagenTemporal(usuario_id, imagen_url, imagen_orden || 0);
      
      return ApiResponse.success(res, { 
        imagen_id: resultado,
        imagen_url: imagen_url 
      }, 'Imagen guardada exitosamente');
    } catch (error) {
      console.error('❌ Error al guardar imagen temporal:', error);
      console.error('❌ Stack trace:', error.stack);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async eliminarImagenTemporal(req, res) {
    try {
      const { usuario_id, imagen_id } = req.body;
      
      if (!usuario_id || !imagen_id) {
        return ApiResponse.error(res, 'El usuario y la imagen son obligatorios', 400);
      }

      if (!Validador.esNumeroValido(imagen_id)) {
        return ApiResponse.error(res, 'ID de imagen inválido', 400);
      }
      
      const resultado = await ProductoService.eliminarImagenTemporal(usuario_id, imagen_id);
      
      if (!resultado) {
        return ApiResponse.error(res, 'No se pudo eliminar la imagen', 404);
      }
      
      return ApiResponse.success(res, { imagen_id }, 'Imagen eliminada exitosamente');
    } catch (error) {
      console.error('❌ Error al eliminar imagen temporal:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async moverImagenTemporal(req, res) {
    try {
      const { imagen_id, nueva_posicion } = req.body;
      
      if (!Validador.esNumeroValido(imagen_id) || !Validador.esNumeroValido(nueva_posicion)) {
        return ApiResponse.error(res, 'ID de imagen y nueva posición son obligatorios', 400);
      }

      await ProductoService.moverImagenTemporal(imagen_id, nueva_posicion);
      
      return ApiResponse.success(res, { imagen_id, nueva_posicion }, 'Imagen movida exitosamente');
    } catch (error) {
      console.error('Error al mover imagen temporal:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async cancelarProceso(req, res) {
    try {
      const { usuario_id } = req.body;
      
      if (!Validador.esNumeroValido(usuario_id)) {
        return ApiResponse.error(res, 'ID de usuario inválido', 400);
      }

      const cancelado = await ProductoService.cancelarProceso(usuario_id);
      
      return ApiResponse.success(res, { cancelado }, 'Proceso cancelado exitosamente');
    } catch (error) {
      console.error('Error al cancelar proceso:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async verificarVentasVariante(req, res) {
    try {
      const { variante_id } = req.params;
      
      if (!Validador.esNumeroValido(variante_id)) {
        return ApiResponse.error(res, 'ID de variante inválido', 400);
      }

      const tieneVentas = await ProductoService.verificarVentasVariante(variante_id);
      
      return ApiResponse.success(res, { tiene_ventas: tieneVentas }, 'Verificación completada');
    } catch (error) {
      console.error('Error al verificar ventas de variante:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async cambiarEstadoVariante(req, res) {
    try {
      const { variante_id, estado } = req.body;
      
      if (!Validador.esNumeroValido(variante_id)) {
        return ApiResponse.error(res, 'ID de variante inválido', 400);
      }

      if (estado === undefined || estado === null) {
        return ApiResponse.error(res, 'Estado es requerido', 400);
      }

      if (!['activo', 'inactivo'].includes(estado)) {
        return ApiResponse.error(res, 'Estado debe ser "activo" o "inactivo"', 400);
      }
      
      const resultado = await ProductoService.cambiarEstadoVariante(variante_id, estado);
      
      if (!resultado) {
        return ApiResponse.error(res, 'No se pudo actualizar la variante', 400);
      }
      
      return ApiResponse.success(res, { variante_id, estado }, 'Estado de variante actualizado exitosamente');
    } catch (error) {
      console.error('❌ Error al cambiar estado de variante:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  // Funciones placeholder para desarrollo futuro
  static async crearBackup(req, res) {
    try {
      return ApiResponse.success(res, {}, 'Funcionalidad en desarrollo');
    } catch (error) {
      console.error('Error en crearBackup:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async restaurarBackup(req, res) {
    try {
      return ApiResponse.success(res, {}, 'Funcionalidad en desarrollo');
    } catch (error) {
      console.error('Error en restaurarBackup:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async exportarProductos(req, res) {
    try {
      return ApiResponse.success(res, {}, 'Funcionalidad en desarrollo');
    } catch (error) {
      console.error('Error en exportarProductos:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async importarProductos(req, res) {
    try {
      return ApiResponse.success(res, {}, 'Funcionalidad en desarrollo');
    } catch (error) {
      console.error('Error en importarProductos:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  // Funciones que aún usan el controlador original hasta ser refactorizadas
  static async subirImagenProducto(req, res) {
    try {
      const { producto_id } = req.params;

      if (!producto_id || !req.file) {
        return ApiResponse.error(res, 'El producto y la imagen son obligatorios.', 400);
      }

      const imagen_url = `/uploads/${req.file.filename}`;
      
      const resultado = await ProductoService.subirImagenProducto(producto_id, imagen_url);
      
      return ApiResponse.success(res, resultado, 'Imagen subida exitosamente.');
    } catch (error) {
      console.error('❌ Error en subirImagenProducto:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async moverImagenProducto(req, res) {
    try {
      const { producto_id, imagen_id, nuevo_orden, nueva_posicion } = req.body;

      // Aceptar tanto nuevo_orden (del original) como nueva_posicion (refactorizado)
      const orden = nuevo_orden !== undefined ? nuevo_orden : nueva_posicion;

      if (!producto_id || !imagen_id || orden === undefined) {
        return ApiResponse.error(res, 'El producto, imagen y nueva posición son obligatorios.', 400);
      }

      await ProductoService.moverImagenProducto(producto_id, imagen_id, orden);

      return ApiResponse.success(res, {}, 'Imagen movida exitosamente.');
    } catch (error) {
      console.error('❌ Error en moverImagenProducto:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async eliminarImagenProducto(req, res) {
    try {
      const { producto_id, imagen_id } = req.params;

      if (!producto_id || !imagen_id) {
        return ApiResponse.error(res, 'El producto y la imagen son obligatorios.', 400);
      }

      await ProductoService.eliminarImagenProducto(producto_id, imagen_id);

      return ApiResponse.success(res, {}, 'Imagen eliminada exitosamente.');
    } catch (error) {
      console.error('Error en eliminarImagenProducto:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  static async eliminarImagenesNuevas(req, res) {
    try {
      const { producto_id, imagenes } = req.body;

      if (!producto_id || !imagenes || !Array.isArray(imagenes)) {
        return ApiResponse.error(res, 'El producto y las imágenes son obligatorios.', 400);
      }

      if (imagenes.length === 0) {
        return ApiResponse.success(res, {}, 'No hay imágenes nuevas para eliminar.');
      }

      await ProductoService.eliminarImagenesNuevas(producto_id, imagenes);

      return ApiResponse.success(res, {}, 'Imágenes nuevas eliminadas correctamente.');
    } catch (error) {
      console.error('Error en eliminarImagenesNuevas:', error);
      return ApiResponse.error(res, 'Error interno del servidor', 500);
    }
  }

  /**
   * Cambia la visibilidad de un producto
   */
  static async cambiarVisibilidad(req, res) {
    try {
      const { producto_id, visible } = req.body;

      console.log('Datos recibidos en cambiarVisibilidad:', { producto_id, visible, type_producto_id: typeof producto_id, type_visible: typeof visible });

      if (!producto_id || visible === undefined) {
        return res.status(400).json({ message: 'El ID del producto y el estado de visibilidad son obligatorios.' });
      }

      const resultado = await ProductoService.cambiarVisibilidadProducto(producto_id, visible);
      
      if (!resultado) {
        return res.status(404).json({ message: 'Producto no encontrado.' });
      }

      res.status(200).json({ message: 'Visibilidad del producto actualizada correctamente.' });
    } catch (error) {
      console.error('Error al cambiar visibilidad del producto:', error);
      res.status(500).json({ message: 'Error interno al cambiar visibilidad del producto.' });
    }
  }

  /**
   * Reactiva un producto eliminado
   */
  static async reactivarProducto(req, res) {
    try {
      const { producto_id } = req.params;

      if (!Validador.esNumeroValido(producto_id)) {
        return res.status(400).json({ message: 'ID de producto inválido.' });
      }

      const resultado = await ProductoService.reactivarProducto(producto_id);
      
      if (!resultado) {
        return res.status(404).json({ message: 'Producto no encontrado.' });
      }

      res.status(200).json({ message: 'Producto reactivado correctamente.' });
    } catch (error) {
      console.error('Error al reactivar producto:', error);
      res.status(500).json({ message: 'Error interno al reactivar producto.' });
    }
  }

  /**
   * Obtiene los detalles del stock de un producto
   */
  static async obtenerDetallesStock(req, res) {
    try {
      const { producto_id } = req.params;

      if (!Validador.esNumeroValido(producto_id)) {
        return res.status(400).json({ message: 'ID de producto inválido.' });
      }

      const detalles = await ProductoService.obtenerDetallesStock(producto_id);
      
      if (!detalles) {
        return res.status(404).json({ message: 'Producto no encontrado.' });
      }

      res.status(200).json(detalles);
    } catch (error) {
      console.error('Error al obtener detalles de stock:', error);
      res.status(500).json({ message: 'Error interno al obtener detalles de stock.' });
    }
  }
}

export default ProductoController;
