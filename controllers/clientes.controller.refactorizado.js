import { ClienteService } from '../services/cliente.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { Validador } from '../utils/validador.js';

// Obtener todos los clientes
export const obtenerClientes = async (req, res) => {
  try {
    const clientes = await ClienteService.obtenerTodos();
    return ApiResponse.success(res, clientes, 'Clientes obtenidos exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener clientes');
  }
};

// Obtener un cliente por ID
export const obtenerClientePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await ClienteService.obtenerPorId(id);
    
    if (!cliente) {
      return ApiResponse.error(res, 'Cliente no encontrado.', 404);
    }
    
    return ApiResponse.success(res, cliente, 'Cliente obtenido exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener cliente');
  }
};

// Crear un nuevo cliente
export const crearCliente = async (req, res) => {
  try {
    // Validar campos obligatorios
    const errores = Validador.validarCliente(req.body);
    if (errores) {
      return ApiResponse.error(res, 'Datos inválidos', 400, errores);
    }
    
    const resultado = await ClienteService.crear(req.body);
    return ApiResponse.success(
      res, 
      resultado, 
      'Cliente creado exitosamente.',
      201
    );
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'crear cliente');
  }
};

// Actualizar un cliente existente
export const actualizarCliente = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar campos obligatorios
    const errores = Validador.validarCliente(req.body);
    if (errores) {
      return ApiResponse.error(res, 'Datos inválidos', 400, errores);
    }
    
    const actualizado = await ClienteService.actualizar(id, req.body);
    
    if (!actualizado) {
      return ApiResponse.error(res, 'Cliente no encontrado.', 404);
    }
    
    return ApiResponse.success(res, { id }, 'Cliente actualizado exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'actualizar cliente');
  }
};

// Eliminar un cliente (baja lógica)
export const eliminarCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await ClienteService.eliminar(id);
    
    if (!eliminado) {
      return ApiResponse.error(res, 'Cliente no encontrado.', 404);
    }
    
    return ApiResponse.success(res, { id }, 'Cliente eliminado exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'eliminar cliente');
  }
};

// Buscar clientes
export const buscarClientes = async (req, res) => {
  try {
    const { termino } = req.query;
    
    if (!termino || termino.trim() === '') {
      return ApiResponse.error(res, 'El término de búsqueda es obligatorio', 400);
    }
    
    const clientes = await ClienteService.buscar(termino);
    return ApiResponse.success(res, clientes, 'Búsqueda realizada exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'buscar clientes');
  }
};

// Obtener clientes dados de baja
export const obtenerClientesEliminados = async (req, res) => {
  try {
    const clientesEliminados = await ClienteService.obtenerEliminados();
    return ApiResponse.success(res, clientesEliminados, 'Clientes eliminados obtenidos exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'obtener clientes eliminados');
  }
};

// Reactivar un cliente dado de baja
export const reactivarCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const reactivado = await ClienteService.reactivar(id);
    
    if (!reactivado) {
      return ApiResponse.error(res, 'Cliente no encontrado o no está dado de baja.', 404);
    }
    
    return ApiResponse.success(res, { id }, 'Cliente reactivado exitosamente');
  } catch (error) {
    return ApiResponse.manejarErrorDB(error, res, 'reactivar cliente');
  }
};
