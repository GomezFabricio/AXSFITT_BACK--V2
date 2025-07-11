/**
 * Clase utilitaria para estandarizar respuestas de la API
 */
export class ApiResponse {
  /**
   * Envía una respuesta exitosa
   * @param {Object} res - Objeto response de Express
   * @param {*} data - Datos a enviar en la respuesta
   * @param {string} message - Mensaje de éxito
   * @param {number} status - Código de estado HTTP
   * @returns {Object} Respuesta HTTP
   */
  static success(res, data, message = 'Operación exitosa', status = 200) {
    return res.status(status).json({
      success: true,
      message,
      data
    });
  }
  
  /**
   * Envía una respuesta de error
   * @param {Object} res - Objeto response de Express
   * @param {string} message - Mensaje de error
   * @param {number} status - Código de estado HTTP
   * @param {Object} errors - Errores específicos (opcional)
   * @returns {Object} Respuesta HTTP
   */
  static error(res, message = 'Error en la operación', status = 500, errors = null) {
    const response = {
      success: false,
      message
    };
    
    if (errors) {
      response.errors = errors;
    }
    
    return res.status(status).json(response);
  }
  
  /**
   * Maneja errores comunes de base de datos
   * @param {Error} error - Error capturado
   * @param {Object} res - Objeto response de Express
   * @param {string} operacion - Descripción de la operación
   * @returns {Object} Respuesta HTTP
   */
  static manejarErrorDB(error, res, operacion) {
    console.error(`Error al ${operacion}:`, error);
    
    // Manejar errores personalizados
    if (error.code === 'EMAIL_DUPLICADO') {
      return ApiResponse.error(res, error.message, 400);
    }
    
    if (error.code === 'CATEGORIA_NO_ENCONTRADA') {
      return ApiResponse.error(res, error.message, 404);
    }
    
    if (error.code === 'CATEGORIA_TIENE_HIJOS') {
      return ApiResponse.error(res, error.message, 400);
    }
    
    if (error.code === 'CATEGORIA_TIENE_PRODUCTOS') {
      return ApiResponse.error(res, error.message, 400);
    }
    
    if (error.code === 'CATEGORIA_DUPLICADA') {
      return ApiResponse.error(res, error.message, 400);
    }
    
    if (error.code === 'CATEGORIA_PADRE_INVALIDA') {
      return ApiResponse.error(res, error.message, 400);
    }
    
    if (error.code === 'CATEGORIA_ORDEN_INVALIDO') {
      return ApiResponse.error(res, error.message, 400);
    }
    
    // Manejar errores de clave duplicada de la base de datos
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.sqlMessage.includes('persona_dni')) {
        return ApiResponse.error(res, 'Ya existe un cliente con ese DNI.', 400);
      }
      if (error.sqlMessage.includes('cliente_email')) {
        return ApiResponse.error(res, 'Ya existe un cliente con ese email.', 400);
      }
      if (error.sqlMessage.includes('categoria_descripcion')) {
        return ApiResponse.error(res, 'Ya existe una categoría con ese nombre.', 400);
      }
      return ApiResponse.error(res, 'Entrada duplicada.', 400);
    }
    
    return ApiResponse.error(res, `Error interno al ${operacion}.`, 500);
  }
}
