/**
 * Clase utilitaria para validación de datos
 */
export class Validador {
  /**
   * Valida los datos básicos de un cliente
   * @param {Object} datos - Datos del cliente a validar
   * @returns {Object|null} Errores encontrados o null si no hay errores
   */
  static validarCliente(datos) {
    const { 
      persona_nombre, 
      persona_apellido, 
      persona_dni, 
      persona_telefono,
      cliente_email 
    } = datos;
    
    const errores = {};
    
    if (!persona_nombre || persona_nombre.trim() === '') {
      errores.persona_nombre = 'El nombre es obligatorio';
    }
    
    if (!persona_apellido || persona_apellido.trim() === '') {
      errores.persona_apellido = 'El apellido es obligatorio';
    }
    
    if (!persona_dni || persona_dni.trim() === '') {
      errores.persona_dni = 'El DNI es obligatorio';
    }
    
    if (!persona_telefono || persona_telefono.trim() === '') {
      errores.persona_telefono = 'El teléfono es obligatorio';
    }
    
    if (!cliente_email || cliente_email.trim() === '') {
      errores.cliente_email = 'El email es obligatorio';
    } else if (!this.validarEmail(cliente_email)) {
      errores.cliente_email = 'El formato del email es inválido';
    }
    
    return Object.keys(errores).length > 0 ? errores : null;
  }
  
  /**
   * Valida un email
   * @param {string} email - Email a validar
   * @returns {boolean} True si el email es válido
   */
  static validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }
}
