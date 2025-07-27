import ProveedorService from '../services/proveedor.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { Validador } from '../utils/validador.js';

// Obtener todos los proveedores
export const obtenerProveedores = async (req, res) => {
  try {
    const proveedores = await ProveedorService.obtenerProveedores();
    return ApiResponse.success(res, proveedores, 'Proveedores obtenidos exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener proveedores');
  }
};

// Obtener un proveedor por ID
export const obtenerProveedorPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const proveedor = await ProveedorService.obtenerProveedorPorId(id);
    if (!proveedor) {
      return ApiResponse.error(res, 'Proveedor no encontrado.', 404);
    }
    return ApiResponse.success(res, proveedor, 'Proveedor obtenido exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener proveedor');
  }
};

// Crear un nuevo proveedor
export const crearProveedor = async (req, res) => {
  try {
    // Validar campos obligatorios
    const errores = Validador.validarProveedor(req.body);
    if (errores) {
      return ApiResponse.error(res, 'Datos inválidos', 400, errores);
    }
    const resultado = await ProveedorService.crearProveedor(req.body);
    return ApiResponse.success(res, resultado, 'Proveedor creado exitosamente.', 201);
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'crear proveedor');
  }
};

// Actualizar un proveedor existente
export const actualizarProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const errores = Validador.validarProveedor(req.body, true);
    if (errores) {
      return ApiResponse.error(res, 'Datos inválidos', 400, errores);
    }
    const actualizado = await ProveedorService.actualizarProveedor(id, req.body);
    if (!actualizado) {
      return ApiResponse.error(res, 'Proveedor no encontrado o sin cambios.', 404);
    }
    return ApiResponse.success(res, null, 'Proveedor actualizado exitosamente.');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'actualizar proveedor');
  }
};

// Eliminar un proveedor (borrado lógico)
export const eliminarProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await ProveedorService.eliminarProveedor(id);
    if (!eliminado) {
      return ApiResponse.error(res, 'Proveedor no encontrado.', 404);
    }
    return ApiResponse.success(res, null, 'Proveedor eliminado exitosamente.');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'eliminar proveedor');
  }
};
