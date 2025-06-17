-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 18-06-2025 a las 00:54:42
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `axsfitt`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `atributos`
--

CREATE TABLE `atributos` (
  `atributo_id` int(10) UNSIGNED NOT NULL,
  `producto_id` int(10) UNSIGNED NOT NULL,
  `atributo_nombre` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `atributos`
--

INSERT INTO `atributos` (`atributo_id`, `producto_id`, `atributo_nombre`) VALUES
(1, 1, 'Sabor'),
(2, 3, 'Sabor'),
(4, 3, 'peso');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categorias`
--

CREATE TABLE `categorias` (
  `categoria_id` int(10) UNSIGNED NOT NULL,
  `categoria_padre_id` int(10) UNSIGNED DEFAULT NULL,
  `categoria_nombre` varchar(100) NOT NULL,
  `categoria_descripcion` text DEFAULT NULL,
  `categoria_estado` enum('activa','inactiva') DEFAULT 'activa',
  `categoria_orden` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` (`categoria_id`, `categoria_padre_id`, `categoria_nombre`, `categoria_descripcion`, `categoria_estado`, `categoria_orden`) VALUES
(1, NULL, 'Proteinas', NULL, 'activa', 1),
(2, NULL, 'Creatinas', NULL, 'activa', 2),
(3, NULL, 'Citratos de Magnesio', NULL, 'activa', 3),
(4, 3, 'Star', NULL, 'activa', 1),
(5, 3, 'One Fit', NULL, 'activa', 2),
(6, 2, 'Star', NULL, 'activa', 1),
(7, 2, 'One Fit', NULL, 'activa', 2),
(8, 1, 'Star', NULL, 'activa', 1),
(9, 1, 'One Fit', NULL, 'activa', 2),
(10, 1, 'Gold Nutrition', NULL, 'activa', 3),
(11, NULL, 'Pre-Entrenos', NULL, 'activa', 4);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `clientes`
--

CREATE TABLE `clientes` (
  `cliente_id` int(10) UNSIGNED NOT NULL,
  `persona_id` int(10) UNSIGNED NOT NULL,
  `cliente_email` varchar(100) DEFAULT NULL,
  `cliente_password` varchar(255) DEFAULT NULL,
  `cliente_google_id` varchar(255) DEFAULT NULL,
  `cliente_fecha_alta` timestamp NOT NULL DEFAULT current_timestamp(),
  `cliente_fecha_baja` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `combos`
--

CREATE TABLE `combos` (
  `combo_id` int(10) UNSIGNED NOT NULL,
  `combo_nombre` varchar(100) NOT NULL,
  `combo_descripcion` text DEFAULT NULL,
  `combo_precio` decimal(10,2) NOT NULL,
  `combo_imagen` varchar(255) DEFAULT NULL,
  `combo_activo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `combos_productos`
--

CREATE TABLE `combos_productos` (
  `cp_id` int(10) UNSIGNED NOT NULL,
  `cp_combo_id` int(10) UNSIGNED NOT NULL,
  `cp_producto_id` int(10) UNSIGNED DEFAULT NULL,
  `cp_variante_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cupones`
--

CREATE TABLE `cupones` (
  `cupon_id` int(10) UNSIGNED NOT NULL,
  `cupon_codigo` varchar(50) NOT NULL,
  `cupon_descripcion` varchar(255) DEFAULT NULL,
  `cupon_descuento_porcentaje` decimal(5,2) NOT NULL COMMENT 'Ej: 15.00 para 15%',
  `cupon_fecha_inicio` date DEFAULT NULL,
  `cupon_fecha_fin` date DEFAULT NULL,
  `cupon_uso_maximo` int(10) UNSIGNED DEFAULT NULL COMMENT 'Cantidad máxima de usos',
  `cupon_uso_actual` int(10) UNSIGNED DEFAULT 0,
  `cupon_activo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `datos_envio`
--

CREATE TABLE `datos_envio` (
  `envio_id` int(10) UNSIGNED NOT NULL,
  `cliente_id` int(10) UNSIGNED NOT NULL,
  `env_calle` varchar(150) NOT NULL,
  `env_numero` varchar(20) NOT NULL,
  `env_cp` varchar(10) NOT NULL,
  `env_piso` varchar(10) DEFAULT NULL,
  `env_depto` varchar(10) DEFAULT NULL,
  `env_ciudad` varchar(100) NOT NULL,
  `env_provincia` varchar(100) NOT NULL,
  `envio_predeterminado` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `envios_invitados`
--

CREATE TABLE `envios_invitados` (
  `envio_invitado_id` int(10) UNSIGNED NOT NULL,
  `venta_id` int(10) UNSIGNED NOT NULL,
  `envinv_nombre` varchar(60) NOT NULL,
  `envinv_apellido` varchar(60) NOT NULL,
  `envinv_email` varchar(100) NOT NULL,
  `envinv_telefono` varchar(20) DEFAULT NULL,
  `envinv_calle` varchar(150) NOT NULL,
  `envinv_numero` varchar(20) NOT NULL,
  `envinv_cp` varchar(10) NOT NULL,
  `envinv_piso` varchar(10) DEFAULT NULL,
  `envinv_depto` varchar(10) DEFAULT NULL,
  `envinv_ciudad` varchar(100) NOT NULL,
  `envinv_provincia` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `estados_usuarios`
--

CREATE TABLE `estados_usuarios` (
  `estado_usuario_id` int(10) UNSIGNED NOT NULL,
  `estado_usuario_nombre` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `estados_usuarios`
--

INSERT INTO `estados_usuarios` (`estado_usuario_id`, `estado_usuario_nombre`) VALUES
(1, 'Activo');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `faltantes`
--

CREATE TABLE `faltantes` (
  `id_faltante` int(10) UNSIGNED NOT NULL,
  `producto_id` int(10) UNSIGNED DEFAULT NULL,
  `variante_id` int(10) UNSIGNED DEFAULT NULL,
  `fecha_deteccion` timestamp NOT NULL DEFAULT current_timestamp(),
  `cantidad_faltante` int(10) UNSIGNED NOT NULL,
  `resuelto` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `imagenes_productos`
--

CREATE TABLE `imagenes_productos` (
  `imagen_id` int(10) UNSIGNED NOT NULL,
  `producto_id` int(10) UNSIGNED NOT NULL,
  `imagen_url` varchar(255) NOT NULL,
  `imagen_orden` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `imagenes_productos`
--

INSERT INTO `imagenes_productos` (`imagen_id`, `producto_id`, `imagen_url`, `imagen_orden`) VALUES
(1, 1, '/uploads/1750199568996-758499934-1.png', 0),
(2, 1, '/uploads/1750199569007-734456741-2.png', 1),
(3, 1, '/uploads/1750199569015-444831855-3.png', 2),
(4, 1, '/uploads/1750199569024-601525703-4.png', 3),
(7, 2, '/uploads/1750199756585-14609685-15.png', 0),
(8, 2, '/uploads/1750199756594-158125603-16.png', 1),
(15, 3, '/uploads/1750199883972-331189334-sabor_chocolate_100_whey_protein_gold_nutrition_proteina_doypack_suplemento_deportivo.png', 0),
(16, 3, '/uploads/1750199883979-236880571-sabor_frutilla_100_whey_protein_gold_nutrition_proteina_doypack_suplemento_deportivo.png', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `imagenes_temporales`
--

CREATE TABLE `imagenes_temporales` (
  `imagen_id` int(10) UNSIGNED NOT NULL,
  `usuario_id` int(10) UNSIGNED NOT NULL,
  `imagen_url` varchar(255) NOT NULL,
  `imagen_orden` int(10) UNSIGNED NOT NULL,
  `fecha_subida` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `modulos`
--

CREATE TABLE `modulos` (
  `modulo_id` int(10) UNSIGNED NOT NULL,
  `modulo_padre_id` int(10) UNSIGNED DEFAULT NULL,
  `modulo_descripcion` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `modulos`
--

INSERT INTO `modulos` (`modulo_id`, `modulo_padre_id`, `modulo_descripcion`) VALUES
(1, NULL, 'Administración del Sistema'),
(2, 1, 'Usuarios'),
(3, 1, 'Perfiles'),
(4, NULL, 'Productos'),
(5, 4, 'Stock'),
(6, NULL, 'Gestión de ventas'),
(7, 6, 'Clientes');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `perfiles`
--

CREATE TABLE `perfiles` (
  `perfil_id` int(10) UNSIGNED NOT NULL,
  `perfil_descripcion` varchar(50) DEFAULT NULL,
  `perfil_estado` enum('activo','inactivo') DEFAULT 'activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `perfiles`
--

INSERT INTO `perfiles` (`perfil_id`, `perfil_descripcion`, `perfil_estado`) VALUES
(1, 'Super Administrador', 'activo');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `perfiles_modulos_permisos`
--

CREATE TABLE `perfiles_modulos_permisos` (
  `pmp_id` int(10) UNSIGNED NOT NULL,
  `perfil_id` int(10) UNSIGNED NOT NULL,
  `modulo_id` int(10) UNSIGNED NOT NULL,
  `permiso_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `perfiles_modulos_permisos`
--

INSERT INTO `perfiles_modulos_permisos` (`pmp_id`, `perfil_id`, `modulo_id`, `permiso_id`) VALUES
(1, 1, 1, 1),
(2, 1, 1, 2),
(3, 1, 2, 3),
(4, 1, 2, 4),
(5, 1, 2, 5),
(6, 1, 2, 6),
(7, 1, 2, 7),
(8, 1, 3, 8),
(9, 1, 3, 9),
(10, 1, 3, 10),
(11, 1, 3, 11),
(12, 1, 4, 12),
(13, 1, 4, 13),
(14, 1, 4, 14),
(15, 1, 4, 15),
(16, 1, 4, 16),
(17, 1, 4, 17),
(18, 1, 4, 18),
(19, 1, 4, 19),
(20, 1, 4, 20),
(21, 1, 5, 21),
(22, 1, 5, 22),
(23, 1, 5, 23),
(24, 1, 6, 24),
(25, 1, 6, 25),
(26, 1, 6, 26),
(27, 1, 6, 27),
(28, 1, 7, 28),
(29, 1, 7, 29),
(30, 1, 7, 30),
(31, 1, 7, 31);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `permisos`
--

CREATE TABLE `permisos` (
  `permiso_id` int(10) UNSIGNED NOT NULL,
  `modulo_id` int(10) UNSIGNED NOT NULL,
  `permiso_descripcion` varchar(50) DEFAULT NULL,
  `permiso_ruta` varchar(100) DEFAULT NULL,
  `permiso_visible_menu` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `permisos`
--

INSERT INTO `permisos` (`permiso_id`, `modulo_id`, `permiso_descripcion`, `permiso_ruta`, `permiso_visible_menu`) VALUES
(1, 1, 'Ver Modulos', '/admin/modulos', 1),
(2, 1, 'Modificar Modulo', NULL, 0),
(3, 2, 'Agregar Usuario', '/admin/usuarios/agregar', 1),
(4, 2, 'Ver Usuarios', '/admin/usuarios', 1),
(5, 2, 'Modificar Usuario', NULL, 0),
(6, 2, 'Eliminar Usuario', NULL, 0),
(7, 2, 'Asignar Perfil', NULL, 0),
(8, 3, 'Agregar Perfil', '/admin/perfiles/agregar', 1),
(9, 3, 'Ver Perfiles', '/admin/perfiles', 1),
(10, 3, 'Modificar Perfil', NULL, 0),
(11, 3, 'Eliminar Perfil', NULL, 0),
(12, 4, 'Ver Categorias', '/productos/categorias', 1),
(13, 4, 'Agregar Categoria', NULL, 0),
(14, 4, 'Modificar Categoria', NULL, 0),
(15, 4, 'Eliminar Categoria', NULL, 0),
(16, 4, 'Agregar Producto', '/productos/agregar', 1),
(17, 4, 'Definir Precio Producto', '/productos/definir-precio', 0),
(18, 4, 'Modificar Producto', NULL, 0),
(19, 4, 'Eliminar Producto', NULL, 0),
(20, 4, 'Ver Productos', '/productos', 1),
(21, 5, 'Gestionar Stock', '/productos/stock', 1),
(22, 5, 'Establecer Stock', NULL, 0),
(23, 5, 'Ver Lista de Faltantes', '/productos/faltantes', 1),
(24, 6, 'Listado de Ventas', '/ventas', 1),
(25, 6, 'Modificar Venta', NULL, 0),
(26, 6, 'Agregar Venta', '/ventas/agregar', 1),
(27, 6, 'Metricas', '/ventas/metricas', 1),
(28, 7, 'Agregar Cliente', '/ventas/clientes/agregar', 1),
(29, 7, 'Ver Clientes', '/ventas/clientes', 1),
(30, 7, 'Modificar Cliente', NULL, 0),
(31, 7, 'Eliminar Cliente', NULL, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `personas`
--

CREATE TABLE `personas` (
  `persona_id` int(10) UNSIGNED NOT NULL,
  `persona_nombre` varchar(60) DEFAULT NULL,
  `persona_apellido` varchar(60) DEFAULT NULL,
  `persona_dni` varchar(60) DEFAULT NULL,
  `persona_fecha_nac` date DEFAULT NULL,
  `persona_domicilio` varchar(255) DEFAULT NULL,
  `persona_telefono` varchar(20) DEFAULT NULL,
  `persona_fecha_alta` date DEFAULT NULL,
  `persona_cuit` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `personas`
--

INSERT INTO `personas` (`persona_id`, `persona_nombre`, `persona_apellido`, `persona_dni`, `persona_fecha_nac`, `persona_domicilio`, `persona_telefono`, `persona_fecha_alta`, `persona_cuit`) VALUES
(1, 'Fabricio', 'Gómez', '44464371', '2002-09-30', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `producto_id` int(10) UNSIGNED NOT NULL,
  `categoria_id` int(10) UNSIGNED NOT NULL,
  `producto_nombre` varchar(255) NOT NULL,
  `producto_descripcion` text DEFAULT NULL,
  `producto_precio_venta` decimal(10,2) DEFAULT NULL,
  `producto_precio_costo` decimal(10,2) DEFAULT NULL,
  `producto_precio_oferta` decimal(10,2) DEFAULT NULL,
  `producto_sku` varchar(50) DEFAULT NULL,
  `producto_estado` enum('activo','inactivo','pendiente') DEFAULT 'activo',
  `producto_fecha_alta` timestamp NOT NULL DEFAULT current_timestamp(),
  `producto_fecha_baja` timestamp NULL DEFAULT NULL,
  `producto_visible` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` (`producto_id`, `categoria_id`, `producto_nombre`, `producto_descripcion`, `producto_precio_venta`, `producto_precio_costo`, `producto_precio_oferta`, `producto_sku`, `producto_estado`, `producto_fecha_alta`, `producto_fecha_baja`, `producto_visible`) VALUES
(1, 8, 'Whey Protein 2Lb', NULL, NULL, NULL, NULL, NULL, 'activo', '2025-06-17 22:34:22', NULL, 1),
(2, 6, 'Creatina Monohidratada', NULL, 24000.00, 30000.00, NULL, NULL, 'activo', '2025-06-17 22:36:02', NULL, 1),
(3, 10, 'Whey Protein', NULL, NULL, NULL, NULL, NULL, 'activo', '2025-06-17 22:39:44', NULL, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `promociones`
--

CREATE TABLE `promociones` (
  `promocion_id` int(10) UNSIGNED NOT NULL,
  `categoria_id` int(10) UNSIGNED NOT NULL,
  `promocion_nombre` varchar(100) NOT NULL,
  `promocion_descripcion` text DEFAULT NULL,
  `promocion_descuento_porcentaje` decimal(5,2) NOT NULL COMMENT 'Ej: 10.00 para 10%',
  `promocion_fecha_inicio` date DEFAULT NULL,
  `promocion_fecha_fin` date DEFAULT NULL,
  `promocion_activa` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `stock`
--

CREATE TABLE `stock` (
  `stock_id` int(10) UNSIGNED NOT NULL,
  `producto_id` int(10) UNSIGNED DEFAULT NULL,
  `variante_id` int(10) UNSIGNED DEFAULT NULL,
  `cantidad` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `ubicacion` varchar(100) DEFAULT NULL,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `stock_minimo` int(10) UNSIGNED DEFAULT 0,
  `stock_maximo` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `stock`
--

INSERT INTO `stock` (`stock_id`, `producto_id`, `variante_id`, `cantidad`, `ubicacion`, `fecha_actualizacion`, `stock_minimo`, `stock_maximo`) VALUES
(1, NULL, 1, 5, NULL, '2025-06-17 22:34:22', 0, NULL),
(2, NULL, 2, 7, NULL, '2025-06-17 22:34:22', 0, NULL),
(3, NULL, 3, 3, NULL, '2025-06-17 22:34:22', 0, NULL),
(4, 2, NULL, 10, NULL, '2025-06-17 22:36:02', 0, NULL),
(5, NULL, 4, 2, NULL, '2025-06-17 22:39:44', 0, NULL),
(6, NULL, 5, 2, NULL, '2025-06-17 22:39:44', 0, NULL),
(8, 3, NULL, 0, NULL, '2025-06-17 22:47:04', 0, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `usuario_id` int(10) UNSIGNED NOT NULL,
  `persona_id` int(10) UNSIGNED NOT NULL,
  `estado_usuario_id` int(10) UNSIGNED NOT NULL,
  `usuario_email` varchar(50) DEFAULT NULL,
  `usuario_pass` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`usuario_id`, `persona_id`, `estado_usuario_id`, `usuario_email`, `usuario_pass`) VALUES
(1, 1, 1, 'fabricio.gomez4371@gmail.com', '$2b$12$rQGnxYjcGUGOPdU1zM4m0OMDLXXuFNqrEVZnKqm0fobgSYKJwmMsa');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios_perfiles`
--

CREATE TABLE `usuarios_perfiles` (
  `perfil_id` int(10) UNSIGNED NOT NULL,
  `usuario_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios_perfiles`
--

INSERT INTO `usuarios_perfiles` (`perfil_id`, `usuario_id`) VALUES
(1, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `valores_variantes`
--

CREATE TABLE `valores_variantes` (
  `variante_id` int(10) UNSIGNED NOT NULL,
  `atributo_id` int(10) UNSIGNED NOT NULL,
  `valor_nombre` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `valores_variantes`
--

INSERT INTO `valores_variantes` (`variante_id`, `atributo_id`, `valor_nombre`) VALUES
(1, 1, 'Vainilla'),
(2, 1, 'Frutilla'),
(3, 1, 'Frutilla'),
(4, 2, 'Chocolate'),
(5, 2, 'Frutilla');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `variantes`
--

CREATE TABLE `variantes` (
  `variante_id` int(10) UNSIGNED NOT NULL,
  `producto_id` int(10) UNSIGNED NOT NULL,
  `imagen_id` int(10) UNSIGNED DEFAULT NULL,
  `variante_precio_venta` decimal(10,2) DEFAULT NULL,
  `variante_precio_costo` decimal(10,2) DEFAULT NULL,
  `variante_precio_oferta` decimal(10,2) DEFAULT NULL,
  `variante_sku` varchar(50) DEFAULT NULL,
  `variante_estado` enum('activo','inactivo','pendiente') DEFAULT 'activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `variantes`
--

INSERT INTO `variantes` (`variante_id`, `producto_id`, `imagen_id`, `variante_precio_venta`, `variante_precio_costo`, `variante_precio_oferta`, `variante_sku`, `variante_estado`) VALUES
(1, 1, 1, 32000.00, 26000.00, NULL, NULL, 'activo'),
(2, 1, 2, 32000.00, 26000.00, 30000.00, NULL, 'activo'),
(3, 1, 3, 32000.00, 26000.00, NULL, NULL, 'activo'),
(4, 3, 15, 35000.00, 28000.00, NULL, NULL, 'activo'),
(5, 3, 16, 35000.00, 28000.00, NULL, NULL, 'activo');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ventas`
--

CREATE TABLE `ventas` (
  `venta_id` int(10) UNSIGNED NOT NULL,
  `cliente_id` int(10) UNSIGNED DEFAULT NULL,
  `cupon_id` int(10) UNSIGNED DEFAULT NULL,
  `venta_fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `venta_estado_pago` enum('pendiente','abonado','cancelado') DEFAULT 'pendiente',
  `venta_estado_envio` enum('pendiente','enviado','entregado','cancelado') DEFAULT 'pendiente',
  `venta_monto_total` decimal(10,2) NOT NULL,
  `venta_monto_descuento` decimal(10,2) DEFAULT 0.00,
  `venta_origen` enum('Venta Manual','Redes Sociales','Whatsapp','Presecial') DEFAULT 'Venta Manual',
  `venta_nota` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ventas_detalle`
--

CREATE TABLE `ventas_detalle` (
  `vd_id` int(10) UNSIGNED NOT NULL,
  `venta_id` int(10) UNSIGNED NOT NULL,
  `producto_id` int(10) UNSIGNED DEFAULT NULL,
  `variante_id` int(10) UNSIGNED DEFAULT NULL,
  `combo_id` int(10) UNSIGNED DEFAULT NULL,
  `vd_cantidad` int(10) UNSIGNED NOT NULL,
  `vd_precio_unitario` decimal(10,2) NOT NULL,
  `vd_subtotal` decimal(10,2) NOT NULL,
  `producto_nombre` varchar(255) DEFAULT NULL,
  `variante_descripcion` varchar(255) DEFAULT NULL,
  `combo_nombre` varchar(255) DEFAULT NULL
) ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `atributos`
--
ALTER TABLE `atributos`
  ADD PRIMARY KEY (`atributo_id`),
  ADD KEY `producto_id` (`producto_id`);

--
-- Indices de la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`categoria_id`),
  ADD KEY `categoria_padre_id` (`categoria_padre_id`);

--
-- Indices de la tabla `clientes`
--
ALTER TABLE `clientes`
  ADD PRIMARY KEY (`cliente_id`),
  ADD UNIQUE KEY `cliente_email` (`cliente_email`),
  ADD KEY `persona_id` (`persona_id`);

--
-- Indices de la tabla `combos`
--
ALTER TABLE `combos`
  ADD PRIMARY KEY (`combo_id`);

--
-- Indices de la tabla `combos_productos`
--
ALTER TABLE `combos_productos`
  ADD PRIMARY KEY (`cp_id`),
  ADD KEY `cp_combo_id` (`cp_combo_id`),
  ADD KEY `cp_producto_id` (`cp_producto_id`),
  ADD KEY `cp_variante_id` (`cp_variante_id`);

--
-- Indices de la tabla `cupones`
--
ALTER TABLE `cupones`
  ADD PRIMARY KEY (`cupon_id`),
  ADD UNIQUE KEY `cupon_codigo` (`cupon_codigo`);

--
-- Indices de la tabla `datos_envio`
--
ALTER TABLE `datos_envio`
  ADD PRIMARY KEY (`envio_id`),
  ADD KEY `cliente_id` (`cliente_id`);

--
-- Indices de la tabla `envios_invitados`
--
ALTER TABLE `envios_invitados`
  ADD PRIMARY KEY (`envio_invitado_id`),
  ADD KEY `venta_id` (`venta_id`);

--
-- Indices de la tabla `estados_usuarios`
--
ALTER TABLE `estados_usuarios`
  ADD PRIMARY KEY (`estado_usuario_id`);

--
-- Indices de la tabla `faltantes`
--
ALTER TABLE `faltantes`
  ADD PRIMARY KEY (`id_faltante`),
  ADD KEY `producto_id` (`producto_id`),
  ADD KEY `variante_id` (`variante_id`);

--
-- Indices de la tabla `imagenes_productos`
--
ALTER TABLE `imagenes_productos`
  ADD PRIMARY KEY (`imagen_id`),
  ADD KEY `producto_id` (`producto_id`);

--
-- Indices de la tabla `imagenes_temporales`
--
ALTER TABLE `imagenes_temporales`
  ADD PRIMARY KEY (`imagen_id`);

--
-- Indices de la tabla `modulos`
--
ALTER TABLE `modulos`
  ADD PRIMARY KEY (`modulo_id`),
  ADD KEY `modulos_FKIndex1` (`modulo_padre_id`);

--
-- Indices de la tabla `perfiles`
--
ALTER TABLE `perfiles`
  ADD PRIMARY KEY (`perfil_id`);

--
-- Indices de la tabla `perfiles_modulos_permisos`
--
ALTER TABLE `perfiles_modulos_permisos`
  ADD PRIMARY KEY (`pmp_id`),
  ADD KEY `pmp_FKIndex1` (`perfil_id`),
  ADD KEY `pmp_FKIndex2` (`modulo_id`),
  ADD KEY `pmp_FKIndex3` (`permiso_id`);

--
-- Indices de la tabla `permisos`
--
ALTER TABLE `permisos`
  ADD PRIMARY KEY (`permiso_id`),
  ADD KEY `permisos_FKIndex1` (`modulo_id`);

--
-- Indices de la tabla `personas`
--
ALTER TABLE `personas`
  ADD PRIMARY KEY (`persona_id`);

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`producto_id`),
  ADD KEY `categoria_id` (`categoria_id`);

--
-- Indices de la tabla `promociones`
--
ALTER TABLE `promociones`
  ADD PRIMARY KEY (`promocion_id`),
  ADD KEY `categoria_id` (`categoria_id`);

--
-- Indices de la tabla `stock`
--
ALTER TABLE `stock`
  ADD PRIMARY KEY (`stock_id`),
  ADD KEY `producto_id` (`producto_id`),
  ADD KEY `variante_id` (`variante_id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`usuario_id`),
  ADD KEY `usuarios_FKIndex1` (`persona_id`),
  ADD KEY `usuarios_FKIndex2` (`estado_usuario_id`);

--
-- Indices de la tabla `usuarios_perfiles`
--
ALTER TABLE `usuarios_perfiles`
  ADD KEY `usuarios_has_perfiles_FKIndex1` (`usuario_id`),
  ADD KEY `usuarios_has_perfiles_FKIndex2` (`perfil_id`);

--
-- Indices de la tabla `valores_variantes`
--
ALTER TABLE `valores_variantes`
  ADD PRIMARY KEY (`variante_id`,`atributo_id`),
  ADD KEY `atributo_id` (`atributo_id`);

--
-- Indices de la tabla `variantes`
--
ALTER TABLE `variantes`
  ADD PRIMARY KEY (`variante_id`),
  ADD KEY `producto_id` (`producto_id`),
  ADD KEY `imagen_id` (`imagen_id`);

--
-- Indices de la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD PRIMARY KEY (`venta_id`),
  ADD KEY `cliente_id` (`cliente_id`),
  ADD KEY `cupon_id` (`cupon_id`);

--
-- Indices de la tabla `ventas_detalle`
--
ALTER TABLE `ventas_detalle`
  ADD PRIMARY KEY (`vd_id`),
  ADD KEY `venta_id` (`venta_id`),
  ADD KEY `producto_id` (`producto_id`),
  ADD KEY `variante_id` (`variante_id`),
  ADD KEY `combo_id` (`combo_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `atributos`
--
ALTER TABLE `atributos`
  MODIFY `atributo_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `categorias`
--
ALTER TABLE `categorias`
  MODIFY `categoria_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `clientes`
--
ALTER TABLE `clientes`
  MODIFY `cliente_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `combos`
--
ALTER TABLE `combos`
  MODIFY `combo_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `combos_productos`
--
ALTER TABLE `combos_productos`
  MODIFY `cp_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `cupones`
--
ALTER TABLE `cupones`
  MODIFY `cupon_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `datos_envio`
--
ALTER TABLE `datos_envio`
  MODIFY `envio_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `envios_invitados`
--
ALTER TABLE `envios_invitados`
  MODIFY `envio_invitado_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `estados_usuarios`
--
ALTER TABLE `estados_usuarios`
  MODIFY `estado_usuario_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `faltantes`
--
ALTER TABLE `faltantes`
  MODIFY `id_faltante` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `imagenes_productos`
--
ALTER TABLE `imagenes_productos`
  MODIFY `imagen_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de la tabla `imagenes_temporales`
--
ALTER TABLE `imagenes_temporales`
  MODIFY `imagen_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `modulos`
--
ALTER TABLE `modulos`
  MODIFY `modulo_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `perfiles`
--
ALTER TABLE `perfiles`
  MODIFY `perfil_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `perfiles_modulos_permisos`
--
ALTER TABLE `perfiles_modulos_permisos`
  MODIFY `pmp_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT de la tabla `permisos`
--
ALTER TABLE `permisos`
  MODIFY `permiso_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT de la tabla `personas`
--
ALTER TABLE `personas`
  MODIFY `persona_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `productos`
--
ALTER TABLE `productos`
  MODIFY `producto_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `promociones`
--
ALTER TABLE `promociones`
  MODIFY `promocion_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `stock`
--
ALTER TABLE `stock`
  MODIFY `stock_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `usuario_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `variantes`
--
ALTER TABLE `variantes`
  MODIFY `variante_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `ventas`
--
ALTER TABLE `ventas`
  MODIFY `venta_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ventas_detalle`
--
ALTER TABLE `ventas_detalle`
  MODIFY `vd_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `atributos`
--
ALTER TABLE `atributos`
  ADD CONSTRAINT `atributos_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD CONSTRAINT `categorias_ibfk_1` FOREIGN KEY (`categoria_padre_id`) REFERENCES `categorias` (`categoria_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `clientes`
--
ALTER TABLE `clientes`
  ADD CONSTRAINT `clientes_ibfk_1` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`persona_id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Filtros para la tabla `combos_productos`
--
ALTER TABLE `combos_productos`
  ADD CONSTRAINT `combos_productos_ibfk_1` FOREIGN KEY (`cp_combo_id`) REFERENCES `combos` (`combo_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `combos_productos_ibfk_2` FOREIGN KEY (`cp_producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `combos_productos_ibfk_3` FOREIGN KEY (`cp_variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `datos_envio`
--
ALTER TABLE `datos_envio`
  ADD CONSTRAINT `datos_envio_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`cliente_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `envios_invitados`
--
ALTER TABLE `envios_invitados`
  ADD CONSTRAINT `envios_invitados_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`venta_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `faltantes`
--
ALTER TABLE `faltantes`
  ADD CONSTRAINT `faltantes_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `faltantes_ibfk_2` FOREIGN KEY (`variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `imagenes_productos`
--
ALTER TABLE `imagenes_productos`
  ADD CONSTRAINT `imagenes_productos_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `modulos`
--
ALTER TABLE `modulos`
  ADD CONSTRAINT `modulos_ibfk_1` FOREIGN KEY (`modulo_padre_id`) REFERENCES `modulos` (`modulo_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `perfiles_modulos_permisos`
--
ALTER TABLE `perfiles_modulos_permisos`
  ADD CONSTRAINT `perfiles_modulos_permisos_ibfk_1` FOREIGN KEY (`perfil_id`) REFERENCES `perfiles` (`perfil_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `perfiles_modulos_permisos_ibfk_2` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`modulo_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `perfiles_modulos_permisos_ibfk_3` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`permiso_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `permisos`
--
ALTER TABLE `permisos`
  ADD CONSTRAINT `permisos_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`modulo_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `productos`
--
ALTER TABLE `productos`
  ADD CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`categoria_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `promociones`
--
ALTER TABLE `promociones`
  ADD CONSTRAINT `promociones_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`categoria_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `stock`
--
ALTER TABLE `stock`
  ADD CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`persona_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`estado_usuario_id`) REFERENCES `estados_usuarios` (`estado_usuario_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `usuarios_perfiles`
--
ALTER TABLE `usuarios_perfiles`
  ADD CONSTRAINT `usuarios_perfiles_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`usuario_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `usuarios_perfiles_ibfk_2` FOREIGN KEY (`perfil_id`) REFERENCES `perfiles` (`perfil_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Filtros para la tabla `valores_variantes`
--
ALTER TABLE `valores_variantes`
  ADD CONSTRAINT `valores_variantes_ibfk_1` FOREIGN KEY (`variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `valores_variantes_ibfk_2` FOREIGN KEY (`atributo_id`) REFERENCES `atributos` (`atributo_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `variantes`
--
ALTER TABLE `variantes`
  ADD CONSTRAINT `variantes_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `variantes_ibfk_2` FOREIGN KEY (`imagen_id`) REFERENCES `imagenes_productos` (`imagen_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`cliente_id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`cupon_id`) REFERENCES `cupones` (`cupon_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `ventas_detalle`
--
ALTER TABLE `ventas_detalle`
  ADD CONSTRAINT `ventas_detalle_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`venta_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ventas_detalle_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ventas_detalle_ibfk_3` FOREIGN KEY (`variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ventas_detalle_ibfk_4` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`combo_id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
