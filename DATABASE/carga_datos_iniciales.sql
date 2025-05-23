-- 1. Estado de usuario
INSERT INTO estados_usuarios (estado_usuario_nombre) VALUES ('Activo');

-- 2. Persona
INSERT INTO personas (persona_nombre, persona_apellido, persona_dni, persona_fecha_nac)
VALUES ('Fabricio', 'Gómez', '44464371', '2002-09-30');

-- 3. Usuario
INSERT INTO usuarios (persona_id, estado_usuario_id, usuario_email, usuario_pass)
VALUES (1, 1, 'fabricio.gomez4371@gmail.com', '$2b$12$rQGnxYjcGUGOPdU1zM4m0OMDLXXuFNqrEVZnKqm0fobgSYKJwmMsa');

-- 4. Perfil
INSERT INTO perfiles (perfil_descripcion) VALUES ('Super Administrador');

-- 5. Asignación de perfil a usuario
INSERT INTO usuarios_perfiles (perfil_id, usuario_id) VALUES (1, 1);

-- 6. Módulos y submódulos según menu_schema.txt
-- 1 Administración del Sistema
INSERT INTO modulos (modulo_padre_id, modulo_descripcion) VALUES
(NULL, 'Administración del Sistema'),      -- 1
(1, 'Usuarios'),                          -- 2
(1, 'Perfiles'),                          -- 3

-- 2 Productos
(NULL, 'Productos'),                      -- 4
(4, 'Categorias'),                        -- 5
(4, 'Configuración Avanzada'),            -- 6

-- 3 Gestión de ventas
(NULL, 'Gestión de ventas'),              -- 7
(7, 'Crear Promociones');                 -- 8

-- 7. Permisos con rutas asociadas y visibilidad en menú
-- Administración del Sistema
INSERT INTO permisos (modulo_id, permiso_descripcion, permiso_ruta, permiso_visible_menu) VALUES
(1, 'Ver Modulos', '/admin/modulos', TRUE), -- 1.1
(2, 'Agregar Usuario', '/admin/usuarios/agregar', TRUE), -- 1.2.1
(2, 'Ver Usuarios', '/admin/usuarios', TRUE), -- 1.2.2
(2, 'Modificar Usuario', NULL, FALSE), -- 1.2.3
(2, 'Eliminar Usuario', NULL, FALSE), -- 1.2.4
(3, 'Agregar Perfil', '/admin/perfiles/agregar', TRUE), -- 1.3.1
(3, 'Ver Perfiles', '/admin/perfiles', TRUE), -- 1.3.2
(3, 'Modificar Perfil', NULL, FALSE), -- 1.3.3
(3, 'Eliminar Perfil', NULL, FALSE), -- 1.3.4

-- Productos
(5, 'Agregar Categoria', '/productos/categorias/agregar', TRUE), -- 2.1.1
(5, 'Ver Categorias', '/productos/categorias', TRUE), -- 2.1.2
(5, 'Modificar Categoria', NULL, FALSE), -- 2.1.3
(5, 'Eliminar Categoria', NULL, FALSE), -- 2.1.4
(4, 'Agregar Producto', '/productos/agregar', TRUE), -- 2.2
(6, 'Aumentar Precios', '/productos/configuracion-avanzada/aumentar-precios', TRUE), -- 2.3.1
(6, 'Notificaciones de stock', '/productos/configuracion-avanzada/notificaciones-stock', TRUE), -- 2.3.2

-- Gestión de ventas
(7, 'Listado de Ventas', '/ventas', TRUE), -- 3.1
(7, 'Agregar Venta', '/ventas/agregar', TRUE), -- 3.2
(7, 'Clientes', '/ventas/clientes', TRUE), -- 3.3
(7, 'Metricas', '/ventas/metricas', TRUE), -- 3.4
(7, 'Metodos de Pago', '/ventas/metodos-pago', TRUE), -- 3.5
(7, 'Metodos de Envio', '/ventas/metodos-envio', TRUE), -- 3.6
(7, 'Logistica', '/ventas/logistica', TRUE), -- 3.7
(8, 'Ofertas', '/ventas/promociones/ofertas', TRUE), -- 3.8.1
(8, 'Cupones de Descuento', '/ventas/promociones/cupones', TRUE); -- 3.8.2

-- 8. Asignar todos los permisos al usuario (usuarios_modulos_permisos)
INSERT INTO usuarios_modulos_permisos (permiso_id, modulo_id, usuario_id) VALUES
(1, 1, 1),   -- Ver Modulos
(2, 2, 1),   -- Agregar Usuario
(3, 2, 1),   -- Ver Usuarios
(4, 2, 1),   -- Modificar Usuario
(5, 2, 1),   -- Eliminar Usuario
(6, 3, 1),   -- Agregar Perfil
(7, 3, 1),   -- Ver Perfiles
(8, 3, 1),   -- Modificar Perfil
(9, 3, 1),   -- Eliminar Perfil
(10, 5, 1),  -- Agregar Categoria
(11, 5, 1),  -- Ver Categorias
(12, 5, 1),  -- Modificar Categoria
(13, 5, 1),  -- Eliminar Categoria
(14, 4, 1),  -- Agregar Producto
(15, 6, 1),  -- Aumentar Precios
(16, 6, 1),  -- Notificaciones de stock
(17, 7, 1),  -- Listado de Ventas
(18, 7, 1),  -- Agregar Venta
(19, 7, 1),  -- Clientes
(20, 7, 1),  -- Metricas
(21, 7, 1),  -- Metodos de Pago
(22, 7, 1),  -- Metodos de Envio
(23, 7, 1),  -- Logistica
(24, 8, 1),  -- Ofertas
(25, 8, 1);  -- Cupones de Descuento

-- 9. Asignar módulos al perfil (perfiles_modulos)
INSERT INTO perfiles_modulos (perfil_id, modulo_id) VALUES
(1, 1), (1, 2), (1, 3),
(1, 4), (1, 5), (1, 6),
(1, 7), (1, 8);