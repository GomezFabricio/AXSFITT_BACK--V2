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

  /**
   * Valida si un valor es un número válido
   * @param {*} valor - Valor a validar
   * @returns {boolean} True si es un número válido
   */
  static esNumeroValido(valor) {
    return valor !== null && valor !== undefined && !isNaN(valor) && valor > 0;
  }

  /**
   * Valida si un texto es válido (no vacío)
   * @param {string} texto - Texto a validar
   * @returns {boolean} True si el texto es válido
   */
  static esTextoValido(texto) {
    return texto && typeof texto === 'string' && texto.trim().length > 0;
  }

  /**
   * Valida si un precio es válido
   * @param {*} precio - Precio a validar
   * @returns {boolean} True si el precio es válido
   */
  static esPrecioValido(precio) {
    return precio !== null && precio !== undefined && !isNaN(precio) && precio >= 0;
  }

  /**
   * Valida los datos básicos de un producto
   * @param {Object} datos - Datos del producto a validar
   * @returns {Object} Objeto con propiedades valido y errores/mensaje
   */
  static validarProducto(datos) {
    const { 
      producto_nombre, 
      categoria_id, 
      producto_precio_venta,
      producto_precio_costo,
      producto_precio_oferta,
      producto_sku
    } = datos;
    
    const errores = {};
    
    if (!this.esTextoValido(producto_nombre)) {
      errores.producto_nombre = 'El nombre del producto es obligatorio';
    } else if (producto_nombre.trim().length < 2) {
      errores.producto_nombre = 'El nombre debe tener al menos 2 caracteres';
    } else if (producto_nombre.trim().length > 255) {
      errores.producto_nombre = 'El nombre no puede tener más de 255 caracteres';
    }
    
    if (!this.esNumeroValido(categoria_id)) {
      errores.categoria_id = 'La categoría es obligatoria';
    }
    
    if (producto_precio_venta && !this.esPrecioValido(producto_precio_venta)) {
      errores.producto_precio_venta = 'El precio de venta debe ser un número válido';
    }
    
    if (producto_precio_costo && !this.esPrecioValido(producto_precio_costo)) {
      errores.producto_precio_costo = 'El precio de costo debe ser un número válido';
    }
    
    if (producto_precio_oferta && !this.esPrecioValido(producto_precio_oferta)) {
      errores.producto_precio_oferta = 'El precio de oferta debe ser un número válido';
    }
    
    if (producto_sku && (typeof producto_sku !== 'string' || producto_sku.trim().length > 100)) {
      errores.producto_sku = 'El SKU debe ser una cadena válida de máximo 100 caracteres';
    }
    
    return {
      valido: Object.keys(errores).length === 0,
      errores: Object.keys(errores).length > 0 ? errores : null
    };
  }
  /**
   * Valida los datos básicos de un proveedor
   * @param {Object} datos - Datos del proveedor a validar
   * @param {boolean} [parcial=false] - Si es true, permite validación parcial (para updates)
   * @returns {Object|null} Objeto con errores si hay, o null si es válido
   */
  static validarProveedor(datos, parcial = false) {
    const {
      proveedor_nombre,
      proveedor_contacto,
      proveedor_email,
      proveedor_telefono,
      proveedor_direccion,
      proveedor_cuit
    } = datos;

    const errores = {};

    if (!parcial || proveedor_nombre !== undefined) {
      if (!this.esTextoValido(proveedor_nombre)) {
        errores.proveedor_nombre = 'El nombre del proveedor es obligatorio';
      } else if (proveedor_nombre.trim().length < 2) {
        errores.proveedor_nombre = 'El nombre debe tener al menos 2 caracteres';
      } else if (proveedor_nombre.trim().length > 100) {
        errores.proveedor_nombre = 'El nombre no puede tener más de 100 caracteres';
      }
    }

    if (!parcial || proveedor_contacto !== undefined) {
      if (proveedor_contacto && proveedor_contacto.trim().length > 100) {
        errores.proveedor_contacto = 'El contacto no puede tener más de 100 caracteres';
      }
    }

    if (!parcial || proveedor_email !== undefined) {
      if (!proveedor_email || proveedor_email.trim() === '') {
        errores.proveedor_email = 'El email es obligatorio';
      } else if (!this.validarEmail(proveedor_email)) {
        errores.proveedor_email = 'El formato del email es inválido';
      } else if (proveedor_email.trim().length > 100) {
        errores.proveedor_email = 'El email no puede tener más de 100 caracteres';
      }
    }

    if (!parcial || proveedor_telefono !== undefined) {
      if (proveedor_telefono && proveedor_telefono.trim().length > 30) {
        errores.proveedor_telefono = 'El teléfono no puede tener más de 30 caracteres';
      }
    }

    if (!parcial || proveedor_direccion !== undefined) {
      if (proveedor_direccion && proveedor_direccion.trim().length > 255) {
        errores.proveedor_direccion = 'La dirección no puede tener más de 255 caracteres';
      }
    }

    if (!parcial || proveedor_cuit !== undefined) {
      if (proveedor_cuit && proveedor_cuit.trim().length > 20) {
        errores.proveedor_cuit = 'El CUIT no puede tener más de 20 caracteres';
      }
    }

    return Object.keys(errores).length > 0 ? errores : null;
  }
}
