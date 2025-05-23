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

-- 7. Permisos con rutas asociadas
-- Administración del Sistema
INSERT INTO permisos (modulo_id, permiso_descripcion, permiso_ruta) VALUES
(1, 'Ver Modulos', '/admin/modulos'), -- 1.1
(2, 'Agregar Usuario', '/admin/usuarios/agregar'), -- 1.2.1
(2, 'Administrar Usuarios', '/admin/usuarios'), -- 1.2.2
(3, 'Agregar Perfil', '/admin/perfiles/agregar'), -- 1.3.1
(3, 'Administrar Perfiles', '/admin/perfiles'), -- 1.3.2

-- Productos
(5, 'Agregar Categoria', '/productos/categorias/agregar'), -- 2.1.1
(5, 'Administrar Categorias', '/productos/categorias'), -- 2.1.2
(4, 'Agregar Producto', '/productos/agregar'), -- 2.2
(6, 'Aumentar Precios', '/productos/configuracion-avanzada/aumentar-precios'), -- 2.3.1
(6, 'Notificaciones de stock', '/productos/configuracion-avanzada/notificaciones-stock'), -- 2.3.2

-- Gestión de ventas
(7, 'Listado de Ventas', '/ventas'), -- 3.1
(7, 'Agregar Venta', '/ventas/agregar'), -- 3.2
(7, 'Clientes', '/ventas/clientes'), -- 3.3
(7, 'Metricas', '/ventas/metricas'), -- 3.4
(7, 'Metodos de Pago', '/ventas/metodos-pago'), -- 3.5
(7, 'Metodos de Envio', '/ventas/metodos-envio'), -- 3.6
(7, 'Logistica', '/ventas/logistica'), -- 3.7
(8, 'Ofertas', '/ventas/promociones/ofertas'), -- 3.8.1
(8, 'Cupones de Descuento', '/ventas/promociones/cupones'); -- 3.8.2

-- 8. Asignar todos los permisos al usuario (usuarios_modulos_permisos)
INSERT INTO usuarios_modulos_permisos (permiso_id, modulo_id, usuario_id) VALUES
(1, 1, 1),   -- Ver Modulos
(2, 2, 1),   -- Agregar Usuario
(3, 2, 1),   -- Administrar Usuarios
(4, 3, 1),   -- Agregar Perfil
(5, 3, 1),   -- Administrar Perfiles
(6, 5, 1),   -- Agregar Categoria
(7, 5, 1),   -- Administrar Categorias
(8, 4, 1),   -- Agregar Producto
(9, 6, 1),   -- Aumentar Precios
(10, 6, 1),  -- Notificaciones de stock
(11, 7, 1),  -- Listado de Ventas
(12, 7, 1),  -- Agregar Venta
(13, 7, 1),  -- Clientes
(14, 7, 1),  -- Metricas
(15, 7, 1),  -- Metodos de Pago
(16, 7, 1),  -- Metodos de Envio
(17, 7, 1),  -- Logistica
(18, 8, 1),  -- Ofertas
(19, 8, 1);  -- Cupones de Descuento

-- 9. Asignar módulos al perfil (perfiles_modulos)
INSERT INTO perfiles_modulos (perfil_id, modulo_id) VALUES
(1, 1), (1, 2), (1, 3),
(1, 4), (1, 5), (1, 6),
(1, 7), (1, 8);