-- 1. Estado de usuario
INSERT INTO estados_usuarios (estado_usuario_nombre) VALUES ('Activo');

-- 2. Persona
INSERT INTO personas (persona_nombre, persona_apellido, persona_dni, persona_fecha_nac)
VALUES ('Fabricio', 'Gómez', '44464371', '2002-09-30');

-- 3. Usuario
INSERT INTO usuarios (persona_id, estado_usuario_id, usuario_email, usuario_pass)
VALUES (1, 1, 'fabricio.gomez4371@gmail.com', '$2b$12$rQGnxYjcGUGOPdU1zM4m0OMDLXXuFNqrEVZnKqm0fobgSYKJwmMsa');

-- 4. Perfil (ahora con estado)
INSERT INTO perfiles (perfil_descripcion, perfil_estado) VALUES ('Super Administrador', 'activo');

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
(4, 'Utilidades Productos'),              -- 6

-- 3 Gestión de ventas
(NULL, 'Gestión de ventas'),              -- 7
(7, 'Promociones');                       -- 8

-- 7. Permisos con rutas asociadas y visibilidad en menú
-- Administración del Sistema
INSERT INTO permisos (modulo_id, permiso_descripcion, permiso_ruta, permiso_visible_menu) VALUES
-- Módulo 1: Administración del Sistema
(1, 'Ver Modulos', '/admin/modulos', TRUE), -- 1.1
(1, 'Modificar Modulo', NULL, FALSE),       -- 1.2

-- Submódulo 1.3: Usuarios
(2, 'Agregar Usuario', '/admin/usuarios/agregar', TRUE), -- 1.3.1
(2, 'Ver Usuarios', '/admin/usuarios', TRUE),            -- 1.3.2
(2, 'Modificar Usuario', NULL, FALSE),                   -- 1.3.3
(2, 'Eliminar Usuario', NULL, FALSE),                    -- 1.3.4
(2, 'Asignar Perfil', NULL, FALSE),                      -- 1.3.5

-- Submódulo 1.4: Perfiles
(3, 'Agregar Perfil', '/admin/perfiles/agregar', TRUE),  -- 1.4.1
(3, 'Ver Perfiles', '/admin/perfiles', TRUE),            -- 1.4.2
(3, 'Modificar Perfil', NULL, FALSE),                    -- 1.4.3
(3, 'Eliminar Perfil', NULL, FALSE),                     -- 1.4.4

-- Módulo 2: Productos
(5, 'Ver Categorias', '/productos/categorias', TRUE),    -- 2.1
(5, 'Agregar Categoria', NULL, FALSE),                   -- 2.2
(5, 'Modificar Categoria', NULL, FALSE),                 -- 2.3
(5, 'Eliminar Categoria', NULL, FALSE),                  -- 2.4
(4, 'Agregar Producto', '/productos/agregar', TRUE),     -- 2.5
(4, 'Ver Productos', '/productos', TRUE),                -- 2.6

-- Submódulo 2.7: Utilidades Productos
(6, 'Aumentar Precios', '/productos/utilidades/aumentar-precios', TRUE),         -- 2.7.1
(6, 'Notificaciones de stock', '/productos/utilidades/notificaciones-stock', TRUE), -- 2.7.2

-- Módulo 3: Gestión de ventas
(7, 'Listado de Ventas', '/ventas', TRUE),               -- 3.1
(7, 'Agregar Venta', '/ventas/agregar', TRUE),           -- 3.2
(7, 'Clientes', '/ventas/clientes', TRUE),               -- 3.3
(7, 'Metricas', '/ventas/metricas', TRUE),               -- 3.4
(7, 'Metodos de Pago', '/ventas/metodos-pago', TRUE),    -- 3.5
(7, 'Metodos de Envio', '/ventas/metodos-envio', TRUE),  -- 3.6
(7, 'Logistica', '/ventas/logistica', TRUE),             -- 3.7

-- Submódulo 3.8: Promociones
(8, 'Ofertas', '/ventas/promociones/ofertas', TRUE),     -- 3.8.1
(8, 'Cupones de Descuento', '/ventas/promociones/cupones', TRUE); -- 3.8.2

-- 8. Asignar todos los permisos al perfil (perfiles_modulos_permisos)
INSERT INTO perfiles_modulos_permisos (perfil_id, modulo_id, permiso_id) VALUES
-- Administración del Sistema
(1, 1, 1),   -- Ver Modulos
(1, 1, 2),   -- Modificar Modulo
(1, 2, 3),   -- Agregar Usuario
(1, 2, 4),   -- Ver Usuarios
(1, 2, 5),   -- Modificar Usuario
(1, 2, 6),   -- Eliminar Usuario
(1, 2, 7),   -- Asignar Perfil
(1, 3, 8),   -- Agregar Perfil
(1, 3, 9),   -- Ver Perfiles
(1, 3, 10),  -- Modificar Perfil
(1, 3, 11),  -- Eliminar Perfil

-- Productos
(1, 5, 12),  -- Ver Categorias
(1, 5, 13),  -- Agregar Categoria
(1, 5, 14),  -- Modificar Categoria
(1, 5, 15),  -- Eliminar Categoria
(1, 4, 16),  -- Agregar Producto
(1, 4, 17),  -- Ver Productos
(1, 6, 18),  -- Aumentar Precios
(1, 6, 19),  -- Notificaciones de stock

-- Gestión de ventas
(1, 7, 20),  -- Listado de Ventas
(1, 7, 21),  -- Agregar Venta
(1, 7, 22),  -- Clientes
(1, 7, 23),  -- Metricas
(1, 7, 24),  -- Metodos de Pago
(1, 7, 25),  -- Metodos de Envio
(1, 7, 26),  -- Logistica
(1, 8, 27),  -- Ofertas
(1, 8, 28);  -- Cupones de Descuento