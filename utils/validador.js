/**
 * Clase utilitaria para validación de datos
 */
export class Validador {
  /**
   * Valida un ID numérico
   * @param {*} id - ID a validar
   * @returns {Object} Objeto con propiedades valido y mensaje
   */
  static validarId(id) {
    if (!id || isNaN(id) || id <= 0) {
      return {
        valido: false,
        mensaje: 'El ID debe ser un número válido mayor que 0'
      };
    }
    
    return {
      valido: true,
      mensaje: 'ID válido'
    };
  }

  /**
   * Valida los datos básicos de una categoría
   * @param {Object} datos - Datos de la categoría a validar
   * @returns {Object} Objeto con propiedades valido y errores/mensaje
   */
  static validarCategoria(datos) {
    const { 
      categoria_nombre, 
      categoria_descripcion, 
      categoria_padre_id 
    } = datos;
    
    const errores = {};
    
    if (!categoria_nombre || categoria_nombre.trim() === '') {
      errores.categoria_nombre = 'El nombre de la categoría es obligatorio';
    } else if (categoria_nombre.trim().length < 2) {
      errores.categoria_nombre = 'El nombre debe tener al menos 2 caracteres';
    } else if (categoria_nombre.trim().length > 100) {
      errores.categoria_nombre = 'El nombre no puede tener más de 100 caracteres';
    }
    
    if (categoria_descripcion && categoria_descripcion.trim().length > 255) {
      errores.categoria_descripcion = 'La descripción no puede tener más de 255 caracteres';
    }
    
    if (categoria_padre_id && (isNaN(categoria_padre_id) || categoria_padre_id <= 0)) {
      errores.categoria_padre_id = 'El ID de la categoría padre debe ser un número válido';
    }
    
    return {
      valido: Object.keys(errores).length === 0,
      errores: Object.keys(errores).length > 0 ? errores : null
    };
  }

  /**
   * Valida los datos básicos de un cliente
   * @param {Object} datos - Datos del cliente a validar
   * @returns {Object} Objeto con propiedades valido y errores/mensaje
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
    
    return {
      valido: Object.keys(errores).length === 0,
      errores: Object.keys(errores).length > 0 ? errores : null
    };
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
