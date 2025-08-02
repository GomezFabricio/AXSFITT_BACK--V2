-- ============================================
-- GESTIÓN DE USUARIOS Y PERMISOS
-- ============================================

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
  permiso_visible_menu BOOLEAN DEFAULT FALSE,
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

-- ============================================
-- GESTIÓN DE CLIENTES Y DATOS DE ENVÍO
-- ============================================

CREATE TABLE clientes (
  cliente_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  persona_id INTEGER UNSIGNED NOT NULL,
  cliente_email VARCHAR(100) NULL UNIQUE,
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
  env_calle VARCHAR(150) NOT NULL,
  env_numero VARCHAR(20) NOT NULL,
  env_cp VARCHAR(10) NOT NULL,
  env_piso VARCHAR(10) NULL,
  env_depto VARCHAR(10) NULL,
  env_ciudad VARCHAR(100) NOT NULL,
  env_provincia VARCHAR(100) NOT NULL,
  envio_predeterminado BOOLEAN DEFAULT FALSE,
  PRIMARY KEY(envio_id),
  FOREIGN KEY(cliente_id)
    REFERENCES clientes(cliente_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================================
-- GESTIÓN DE PRODUCTOS Y CATEGORÍAS
-- ============================================

CREATE TABLE categorias (
  categoria_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_padre_id INTEGER UNSIGNED NULL,
  categoria_nombre VARCHAR(100) NOT NULL,
  categoria_descripcion TEXT NULL,
  categoria_orden INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (categoria_id),
  FOREIGN KEY (categoria_padre_id)
    REFERENCES categorias(categoria_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE productos (
  producto_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id INTEGER UNSIGNED NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  producto_descripcion TEXT NULL,
  producto_precio_venta DECIMAL(10, 2) NULL,
  producto_precio_costo DECIMAL(10, 2) NULL,
  producto_precio_oferta DECIMAL(10, 2) NULL,
  producto_sku VARCHAR(50) NULL,
  producto_estado ENUM('activo', 'inactivo', 'pendiente') DEFAULT 'activo',
  producto_fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  producto_fecha_baja TIMESTAMP NULL,
  producto_visible BOOLEAN DEFAULT TRUE,
  PRIMARY KEY(producto_id),
  FOREIGN KEY(categoria_id)
    REFERENCES categorias(categoria_id)
    ON DELETE SET NULL
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

CREATE TABLE imagenes_temporales (
  imagen_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INTEGER UNSIGNED NOT NULL, 
  imagen_url VARCHAR(255) NOT NULL,
  imagen_orden INTEGER UNSIGNED NOT NULL,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(imagen_id)
);

CREATE TABLE atributos (
  atributo_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INTEGER UNSIGNED NOT NULL,
  atributo_nombre VARCHAR(100) NOT NULL,
  PRIMARY KEY(atributo_id),
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE variantes (
  variante_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INTEGER UNSIGNED NOT NULL,
  imagen_id INTEGER UNSIGNED NULL,
  variante_precio_venta DECIMAL(10,2),
  variante_precio_costo DECIMAL(10,2),
  variante_precio_oferta DECIMAL(10,2),
  variante_sku VARCHAR(50),
  variante_estado ENUM('activo', 'inactivo', 'pendiente') DEFAULT 'activo',
  PRIMARY KEY(variante_id),
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(imagen_id) REFERENCES imagenes_productos(imagen_id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE valores_variantes (
  variante_id INTEGER UNSIGNED NOT NULL,
  atributo_id INTEGER UNSIGNED NOT NULL,
  valor_nombre VARCHAR(100) NOT NULL,
  PRIMARY KEY (variante_id, atributo_id),
  FOREIGN KEY(variante_id) REFERENCES variantes(variante_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(atributo_id) REFERENCES atributos(atributo_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);


-- ============================================
-- GESTIÓN DE PROVEEDORES
-- ============================================

CREATE TABLE proveedores (
  proveedor_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proveedor_nombre VARCHAR(255) NOT NULL,
  proveedor_contacto VARCHAR(255) NULL,
  proveedor_email VARCHAR(255) NULL,
  proveedor_telefono VARCHAR(20) NULL,
  proveedor_direccion TEXT NULL,
  proveedor_cuit VARCHAR(20) NULL,
  proveedor_estado ENUM('activo', 'inactivo') DEFAULT 'activo',
  proveedor_fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (proveedor_id)
);

-- ============================================
-- GESTIÓN DE PEDIDOS
-- ============================================

CREATE TABLE pedidos (
  pedido_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_proveedor_id INT UNSIGNED NOT NULL,
  pedido_usuario_id INT UNSIGNED NOT NULL,
  pedido_fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pedido_fecha_esperada_entrega DATE NULL,
  pedido_fecha_entrega_real DATE NULL,
  pedido_estado ENUM('pendiente', 'enviado', 'modificado', 'parcial', 'completo', 'cancelado') DEFAULT 'pendiente',
  pedido_observaciones TEXT NULL,
  pedido_total DECIMAL(10,2) NULL,
  pedido_descuento DECIMAL(10,2) DEFAULT 0,
  pedido_costo_envio DECIMAL(10,2) DEFAULT 0,
  PRIMARY KEY (pedido_id),
  FOREIGN KEY (pedido_proveedor_id) REFERENCES proveedores(proveedor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (pedido_usuario_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE pedidos_detalle (
  pd_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pd_pedido_id INT UNSIGNED NOT NULL,
  pd_producto_id INT UNSIGNED NULL,
  pd_variante_id INT UNSIGNED NULL,
  pd_producto_sin_registrar VARCHAR(255) NULL,
  pd_cantidad_pedida INT UNSIGNED NOT NULL,
  pd_cantidad_recibida INT UNSIGNED DEFAULT 0,
  pd_precio_unitario DECIMAL(10,2) NULL,
  pd_subtotal DECIMAL(10,2) NULL,
  PRIMARY KEY (pd_id),
  FOREIGN KEY (pd_pedido_id) REFERENCES pedidos(pedido_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (pd_producto_id) REFERENCES productos(producto_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (pd_variante_id) REFERENCES variantes(variante_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================
-- GESTIÓN DE MODIFICACIONES DE PEDIDOS
-- ============================================

CREATE TABLE pedidos_modificaciones (
  pm_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pm_pedido_id INT UNSIGNED NOT NULL,
  pm_usuario_id INT UNSIGNED NOT NULL,
  pm_fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pm_motivo TEXT NOT NULL,
  pm_detalle_anterior JSON NOT NULL,
  pm_detalle_nuevo JSON NOT NULL,
  PRIMARY KEY (pm_id),
  FOREIGN KEY (pm_pedido_id) REFERENCES pedidos(pedido_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (pm_usuario_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================
-- GESTIÓN DE STOCK
-- ============================================

CREATE TABLE stock (
  stock_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INTEGER UNSIGNED NULL,
  variante_id INTEGER UNSIGNED NULL,
  cantidad INTEGER UNSIGNED NOT NULL DEFAULT 0,
  ubicacion VARCHAR(100) NULL,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  stock_minimo INTEGER UNSIGNED NULL DEFAULT 0,
  stock_maximo INTEGER UNSIGNED NULL,
  PRIMARY KEY(stock_id),
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(variante_id) REFERENCES variantes(variante_id) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE faltantes (
  faltante_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  faltante_producto_id INT UNSIGNED NULL,
  faltante_variante_id INT UNSIGNED NULL,
  faltante_fecha_deteccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  faltante_cantidad_original INT UNSIGNED NOT NULL,
  faltante_cantidad_faltante INT UNSIGNED NOT NULL,
  faltante_cantidad_solicitada INT UNSIGNED DEFAULT 0,
  faltante_estado ENUM('detectado', 'registrado', 'solicitado_parcial', 'solicitado_completo', 'pedido_generado', 'en_transito', 'resuelto') DEFAULT 'detectado',
  faltante_pedido_id INT UNSIGNED NULL,
  faltante_resuelto BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (faltante_id),
  FOREIGN KEY (faltante_producto_id) REFERENCES productos(producto_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (faltante_variante_id) REFERENCES variantes(variante_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (faltante_pedido_id) REFERENCES pedidos(pedido_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- GESTIÓN DE HISTÓRICO DE PRECIOS
-- ============================================

CREATE TABLE precios_historicos (
  ph_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ph_producto_id INT UNSIGNED NOT NULL,
  ph_variante_id INT UNSIGNED NULL,
  ph_precio_costo_anterior DECIMAL(10,2) NULL,
  ph_precio_costo_nuevo DECIMAL(10,2) NOT NULL,
  ph_precio_venta_anterior DECIMAL(10,2) NULL,
  ph_precio_venta_nuevo DECIMAL(10,2) NULL,
  ph_motivo ENUM('recepcion_pedido', 'ajuste_manual', 'promocion', 'inflacion', 'correccion') NOT NULL,
  ph_pedido_id INT UNSIGNED NULL,
  ph_usuario_id INT UNSIGNED NOT NULL,
  ph_fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ph_observaciones TEXT NULL,
  PRIMARY KEY (ph_id),
  FOREIGN KEY (ph_producto_id) REFERENCES productos(producto_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (ph_variante_id) REFERENCES variantes(variante_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (ph_pedido_id) REFERENCES pedidos(pedido_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (ph_usuario_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT ON UPDATE CASCADE
);


-- ============================================
-- GESTIÓN DE COMBOS
-- ============================================

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
  cp_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  cp_combo_id INTEGER UNSIGNED NOT NULL,
  cp_producto_id INTEGER UNSIGNED NULL,
  cp_variante_id INTEGER UNSIGNED NULL,
  PRIMARY KEY(cp_id),
  FOREIGN KEY(cp_combo_id) REFERENCES combos(combo_id) ON DELETE CASCADE,
  FOREIGN KEY(cp_producto_id) REFERENCES productos(producto_id) ON DELETE CASCADE,
  FOREIGN KEY(cp_variante_id) REFERENCES variantes(variante_id) ON DELETE CASCADE
);

-- ============================================
-- GESTIÓN DE CUPONES
-- ============================================

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

-- ============================================
-- GESTIÓN DE PROMOCIONES
-- ============================================

CREATE TABLE promociones (
  promocion_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id INTEGER UNSIGNED NULL,
  promocion_nombre VARCHAR(100) NOT NULL,
  promocion_descripcion TEXT NULL,
  promocion_descuento_porcentaje DECIMAL(5, 2) NOT NULL COMMENT 'Ej: 10.00 para 10%',
  promocion_fecha_inicio DATE NULL,
  promocion_fecha_fin DATE NULL,
  promocion_activa BOOLEAN DEFAULT TRUE,
  PRIMARY KEY(promocion_id),
  FOREIGN KEY(categoria_id)
    REFERENCES categorias(categoria_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- ============================================
-- GESTIÓN DE VENTAS
-- ============================================

CREATE TABLE ventas (
  venta_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id INTEGER UNSIGNED NULL, -- Modificado a NULL para permitir ventas a invitados
  cupon_id INTEGER UNSIGNED NULL,
  venta_fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  venta_estado_pago ENUM('pendiente', 'abonado', 'cancelado') DEFAULT 'pendiente',
  venta_estado_envio ENUM('pendiente', 'enviado', 'entregado', 'cancelado') DEFAULT 'pendiente',
  venta_monto_total DECIMAL(10, 2) NOT NULL,
  venta_monto_descuento DECIMAL(10, 2) DEFAULT 0.00,
  venta_origen ENUM('Venta Manual', 'Redes Sociales', 'Whatsapp', 'Presecial') DEFAULT 'Venta Manual',
  venta_nota TEXT NULL,
  PRIMARY KEY(venta_id),
  FOREIGN KEY(cliente_id) REFERENCES clientes(cliente_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  FOREIGN KEY(cupon_id) REFERENCES cupones(cupon_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE ventas_detalle (
  vd_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INTEGER UNSIGNED NOT NULL,
  producto_id INTEGER UNSIGNED NULL,
  variante_id INTEGER UNSIGNED NULL,
  combo_id INTEGER UNSIGNED NULL,
  vd_cantidad INTEGER UNSIGNED NOT NULL,
  vd_precio_unitario DECIMAL(10, 2) NOT NULL,
  vd_subtotal DECIMAL(10, 2) NOT NULL,
  producto_nombre VARCHAR(255) NULL,
  variante_descripcion VARCHAR(255) NULL,
  combo_nombre VARCHAR(255) NULL,
  PRIMARY KEY(vd_id),
  FOREIGN KEY(venta_id) REFERENCES ventas(venta_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(producto_id) REFERENCES productos(producto_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY(variante_id) REFERENCES variantes(variante_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY(combo_id) REFERENCES combos(combo_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CHECK (
    (producto_id IS NOT NULL AND variante_id IS NULL AND combo_id IS NULL) OR
    (producto_id IS NULL AND variante_id IS NOT NULL AND combo_id IS NULL) OR
    (producto_id IS NULL AND variante_id IS NULL AND combo_id IS NOT NULL) OR
    (producto_id IS NULL AND variante_id IS NULL AND combo_id IS NULL AND producto_nombre IS NOT NULL)
  )
);

-- ============================================
-- GESTIÓN DE MOVIMIENTOS DE STOCK
-- ============================================

CREATE TABLE stock_movimientos (
  sm_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sm_producto_id INT UNSIGNED NOT NULL,
  sm_variante_id INT UNSIGNED NULL,
  sm_tipo_movimiento ENUM('entrada', 'salida', 'ajuste', 'venta', 'devolucion') NOT NULL,
  sm_cantidad INT NOT NULL,
  sm_motivo VARCHAR(255) NULL,
  sm_pedido_id INT UNSIGNED NULL,
  sm_venta_id INT UNSIGNED NULL,
  sm_usuario_id INT UNSIGNED NOT NULL,
  sm_fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sm_observaciones TEXT NULL,
  PRIMARY KEY (sm_id),
  FOREIGN KEY (sm_producto_id) REFERENCES productos(producto_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (sm_variante_id) REFERENCES variantes(variante_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (sm_pedido_id) REFERENCES pedidos(pedido_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (sm_venta_id) REFERENCES ventas(venta_id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (sm_usuario_id) REFERENCES usuarios(usuario_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE envios_invitados (
  envio_invitado_id INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INTEGER UNSIGNED NOT NULL,
  envinv_nombre VARCHAR(60) NOT NULL, 
  envinv_apellido VARCHAR(60) NOT NULL, 
  envinv_email VARCHAR(100) NOT NULL, 
  envinv_telefono VARCHAR(20) NULL,
  envinv_calle VARCHAR(150) NOT NULL,
  envinv_numero VARCHAR(20) NOT NULL,
  envinv_cp VARCHAR(10) NOT NULL,
  envinv_piso VARCHAR(10) NULL,
  envinv_depto VARCHAR(10) NULL,
  envinv_ciudad VARCHAR(100) NOT NULL,
  envinv_provincia VARCHAR(100) NOT NULL,
  PRIMARY KEY(envio_invitado_id),
  FOREIGN KEY(venta_id) REFERENCES ventas(venta_id) ON DELETE CASCADE ON UPDATE CASCADE
);

