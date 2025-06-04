-- EXISTENTE: Gestión de Usuarios y Permisos

CREATE TABLE perfiles (
  perfil_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  perfil_descripcion VARCHAR(50) NULL,
  perfil_estado ENUM('activo','inactivo') DEFAULT 'activo',
  PRIMARY KEY(perfil_id)
);

CREATE TABLE personas (
  persona_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_nombre VARCHAR(60) NULL,
  persona_apellido VARCHAR(60) NULL,
  persona_dni VARCHAR(60) NULL,
  persona_fecha_nac DATE NULL,
  persona_domicilio VARCHAR(255) NULL,
  persona_telefono VARCHAR(20) NULL,
  persona_fecha_alta DATE NULL,
  persona_cuit VARCHAR(50) NULL,
  PRIMARY KEY(persona_id)
);

CREATE TABLE estados_usuarios (
  estado_usuario_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  estado_usuario_nombre VARCHAR(50) NULL,
  PRIMARY KEY(estado_usuario_id)
);

CREATE TABLE modulos (
  modulo_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  modulo_padre_id INTEGER UNSIGNED NULL,
  modulo_descripcion VARCHAR(50) NULL,
  PRIMARY KEY(modulo_id),
  INDEX modulos_FKIndex1(modulo_padre_id),
  FOREIGN KEY(modulo_padre_id)
    REFERENCES modulos(modulo_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE TABLE permisos (
  permiso_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  modulo_id INTEGER UNSIGNED NOT NULL,
  permiso_descripcion VARCHAR(50) NULL,
  permiso_ruta VARCHAR(100) NULL,
  permiso_visible_menu BOOLEAN DEFAULT FALSE, -- Nuevo campo: indica si el permiso es visible en el menú
  PRIMARY KEY(permiso_id),
  INDEX permisos_FKIndex1(modulo_id),
  FOREIGN KEY(modulo_id)
    REFERENCES modulos(modulo_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE TABLE usuarios (
  usuario_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INTEGER UNSIGNED NOT NULL,
  estado_usuario_id INTEGER UNSIGNED NOT NULL,
  usuario_email VARCHAR(50) NULL,
  usuario_pass VARCHAR(255) NULL,
  PRIMARY KEY(usuario_id),
  INDEX usuarios_FKIndex1(persona_id),
  INDEX usuarios_FKIndex2(estado_usuario_id),
  FOREIGN KEY(persona_id)
    REFERENCES personas(persona_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  FOREIGN KEY(estado_usuario_id)
    REFERENCES estados_usuarios(estado_usuario_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE TABLE usuarios_perfiles (
  perfil_id INTEGER UNSIGNED NOT NULL,
  usuario_id INTEGER UNSIGNED NOT NULL,
  INDEX usuarios_has_perfiles_FKIndex1(usuario_id),
  INDEX usuarios_has_perfiles_FKIndex2(perfil_id),
  FOREIGN KEY(usuario_id)
    REFERENCES usuarios(usuario_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  FOREIGN KEY(perfil_id)
    REFERENCES perfiles(perfil_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- NUEVA TABLA: Asignación de permisos a perfiles sobre módulos
CREATE TABLE perfiles_modulos_permisos (
  pmp_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  perfil_id INTEGER UNSIGNED NOT NULL,
  modulo_id INTEGER UNSIGNED NOT NULL,
  permiso_id INTEGER UNSIGNED NOT NULL,
  PRIMARY KEY(pmp_id),
  INDEX pmp_FKIndex1(perfil_id),
  INDEX pmp_FKIndex2(modulo_id),
  INDEX pmp_FKIndex3(permiso_id),
  FOREIGN KEY(perfil_id)
    REFERENCES perfiles(perfil_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  FOREIGN KEY(modulo_id)
    REFERENCES modulos(modulo_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  FOREIGN KEY(permiso_id)
    REFERENCES permisos(permiso_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- Elimina las tablas que ya no se usan con la nueva lógica
DROP TABLE IF EXISTS usuarios_modulos_permisos;
DROP TABLE IF EXISTS perfiles_modulos;

-- NUEVAS TABLAS: Gestión de Clientes y Datos de Envío

CREATE TABLE clientes (
  cliente_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INTEGER UNSIGNED NOT NULL,
  cliente_email VARCHAR(100) NOT NULL UNIQUE,
  cliente_password VARCHAR(255) NULL,
  cliente_google_id VARCHAR(255) NULL,
  cliente_fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cliente_fecha_baja TIMESTAMP NULL,
  PRIMARY KEY(cliente_id),
  FOREIGN KEY(persona_id)
    REFERENCES personas(persona_id)
    ON DELETE NO ACTION
    ON UPDATE CASCADE
);

CREATE TABLE datos_envio (
  envio_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id INTEGER UNSIGNED NOT NULL,
  envio_direccion VARCHAR(255) NOT NULL,
  envio_ciudad VARCHAR(100) NOT NULL,
  envio_provincia VARCHAR(100) NOT NULL,
  envio_codigo_postal VARCHAR(20) NOT NULL,
  envio_pais VARCHAR(100) NOT NULL,
  envio_telefono VARCHAR(20) NULL,
  envio_predeterminado BOOLEAN DEFAULT FALSE,
  PRIMARY KEY(envio_id),
  FOREIGN KEY(cliente_id)
    REFERENCES clientes(cliente_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- NUEVAS TABLAS: Gestión de Productos y Categorías

CREATE TABLE categorias (
  categoria_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_padre_id INTEGER UNSIGNED NULL,
  categoria_nombre VARCHAR(100) NOT NULL,
  categoria_descripcion TEXT NULL,
  categoria_estado ENUM('activa', 'inactiva') DEFAULT 'activa',
  categoria_orden INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (categoria_id),
  FOREIGN KEY (categoria_padre_id)
    REFERENCES categorias(categoria_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE productos (
  producto_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id INTEGER UNSIGNED NOT NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  producto_descripcion TEXT NULL,
  producto_precio_venta DECIMAL(10, 2) NULL,
  producto_precio_costo DECIMAL(10, 2) NULL,
  producto_precio_oferta DECIMAL(10, 2) NULL,
  producto_sku VARCHAR(50) NULL,
  producto_stock INTEGER UNSIGNED NULL,
  producto_estado ENUM('activo', 'inactivo') DEFAULT 'activo',
  producto_fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  producto_fecha_baja TIMESTAMP NULL,
  PRIMARY KEY(producto_id),
  FOREIGN KEY(categoria_id)
    REFERENCES categorias(categoria_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE atributos (
  atributo_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INTEGER UNSIGNED NOT NULL,
  atributo_nombre VARCHAR(100) NOT NULL,
  atributo_precio VARCHAR(100) NOT NULL,
  atributo_stock INTEGER UNSIGNED NULL,
  atributo_imagen VARCHAR(255) NULL,
  PRIMARY KEY(atributo_id),
  FOREIGN KEY(producto_id)
    REFERENCES productos(producto_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE imagenes_productos (
  imagen_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INTEGER UNSIGNED NOT NULL,
  imagen_url VARCHAR(255) NOT NULL,
  imagen_orden INTEGER UNSIGNED NOT NULL,
  PRIMARY KEY(imagen_id),
  FOREIGN KEY(producto_id)
    REFERENCES productos(producto_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- NUEVA TABLA: Histórico de Costos y Stock

CREATE TABLE historico_costos_stock (
  historico_id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INTEGER UNSIGNED NOT NULL,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  precio_costo_anterior DECIMAL(10, 2) NOT NULL,
  precio_costo_nuevo DECIMAL(10, 2) NOT NULL,
  stock_anterior INTEGER UNSIGNED NULL,
  stock_nuevo INTEGER UNSIGNED NULL,
  FOREIGN KEY (producto_id) REFERENCES productos(producto_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- NUEVA TABLA: Política de Precios

CREATE TABLE politica_precios (
  politica_id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  categoria_id INTEGER UNSIGNED NOT NULL,
  margen_min DECIMAL(5, 2) NOT NULL COMMENT 'Ej: 0.10 para 10%',
  margen_max DECIMAL(5, 2) NOT NULL COMMENT 'Ej: 0.50 para 50%',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- NUEVAS TABLAS: Cupones de Descuento

CREATE TABLE cupones (
  cupon_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  cupon_codigo VARCHAR(50) NOT NULL UNIQUE,
  cupon_descripcion VARCHAR(255) NULL,
  cupon_descuento_porcentaje DECIMAL(5, 2) NOT NULL COMMENT 'Ej: 15.00 para 15%',
  cupon_fecha_inicio DATE NULL,
  cupon_fecha_fin DATE NULL,
  cupon_uso_maximo INTEGER UNSIGNED NULL COMMENT 'Cantidad máxima de usos',
  cupon_uso_actual INTEGER UNSIGNED DEFAULT 0,
  cupon_activo BOOLEAN DEFAULT TRUE,
  PRIMARY KEY(cupon_id)
);

-- NUEVAS TABLAS: Gestión de Ventas

CREATE TABLE ventas (
  venta_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id INTEGER UNSIGNED NOT NULL,
  cupon_id INTEGER UNSIGNED NULL,
  venta_fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  venta_estado_pago ENUM('pendiente', 'abonado', 'cancelado') DEFAULT 'pendiente',
  venta_estado_envio ENUM('pendiente', 'enviado', 'entregado', 'cancelado') DEFAULT 'pendiente',
  venta_monto_total DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY(venta_id),
  FOREIGN KEY(cliente_id)
    REFERENCES clientes(cliente_id)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  FOREIGN KEY(cupon_id)
    REFERENCES cupones(cupon_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE envios_invitados (
  envio_invitado_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INTEGER UNSIGNED NOT NULL,
  envio_nombre VARCHAR(100) NOT NULL,
  envio_apellido VARCHAR(100) NOT NULL,
  envio_email VARCHAR(100) NOT NULL,
  envio_direccion VARCHAR(255) NOT NULL,
  envio_ciudad VARCHAR(100) NOT NULL,
  envio_provincia VARCHAR(100) NOT NULL,
  envio_codigo_postal VARCHAR(20) NOT NULL,
  envio_pais VARCHAR(100) NOT NULL,
  envio_telefono VARCHAR(20) NULL,
  PRIMARY KEY(envio_invitado_id),
  FOREIGN KEY(venta_id)
    REFERENCES ventas(venta_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE ventas_detalle (
  detalle_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INTEGER UNSIGNED NOT NULL,
  producto_id INTEGER UNSIGNED NOT NULL,
  atributo_id INTEGER UNSIGNED NULL,
  cantidad INTEGER UNSIGNED NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY(detalle_id),
  FOREIGN KEY(venta_id) REFERENCES ventas(venta_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(atributo_id) REFERENCES atributos(atributo_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- NUEVAS TABLAS: Promociones por Categoría

CREATE TABLE promociones (
  promocion_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id INTEGER UNSIGNED NOT NULL,
  promocion_nombre VARCHAR(100) NOT NULL,
  promocion_descripcion TEXT NULL,
  promocion_descuento_porcentaje DECIMAL(5, 2) NOT NULL COMMENT 'Ej: 10.00 para 10%',
  promocion_fecha_inicio DATE NULL,
  promocion_fecha_fin DATE NULL,
  promocion_activa BOOLEAN DEFAULT TRUE,
  PRIMARY KEY(promocion_id),
  FOREIGN KEY(categoria_id)
    REFERENCES categorias(categoria_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- NUEVAS TABLAS: Gestión de Combos

CREATE TABLE combos (
  combo_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  combo_nombre VARCHAR(100) NOT NULL,
  combo_descripcion TEXT NULL,
  combo_precio DECIMAL(10,2) NOT NULL,
  combo_imagen VARCHAR(255) NULL,
  combo_activo BOOLEAN DEFAULT TRUE,
  PRIMARY KEY(combo_id)
);

CREATE TABLE combos_productos (
  combo_producto_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  combo_id INTEGER UNSIGNED NOT NULL,
  producto_id INTEGER UNSIGNED NOT NULL,
  atributo_id INTEGER UNSIGNED NULL, -- Si el combo incluye un atributo fijo, si no NULL
  cantidad INTEGER UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY(combo_producto_id),
  FOREIGN KEY(combo_id) REFERENCES combos(combo_id) ON DELETE CASCADE,
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id) ON DELETE CASCADE,
  FOREIGN KEY(atributo_id) REFERENCES atributos(atributo_id) ON DELETE SET NULL
);

CREATE TABLE ventas_detalle_combo_atributos (
  vca_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  detalle_id INTEGER UNSIGNED NOT NULL, -- referencia a ventas_detalle (el combo vendido)
  producto_id INTEGER UNSIGNED NOT NULL,
  atributo_id INTEGER UNSIGNED NULL,
  cantidad INTEGER UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY(vca_id),
  FOREIGN KEY(detalle_id) REFERENCES ventas_detalle(detalle_id) ON DELETE CASCADE,
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id) ON DELETE CASCADE,
  FOREIGN KEY(atributo_id) REFERENCES atributos(atributo_id) ON DELETE SET NULL
);