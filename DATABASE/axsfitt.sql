-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 14-11-2025 a las 10:24:43
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

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_agrupar_notificaciones_pendientes` ()   BEGIN
          DECLARE done INT DEFAULT FALSE;
          DECLARE v_fecha_envio DATE;
          DECLARE v_tipo_frecuencia VARCHAR(20);
          DECLARE v_count INT;
          
          DECLARE cur_grupos CURSOR FOR
              SELECT fecha_envio_programada, tipo_frecuencia, COUNT(*) as cantidad
              FROM notificaciones_pendientes 
              WHERE estado = 'pendiente' 
              AND tipo_frecuencia IN ('diaria', 'semanal')
              AND fecha_envio_programada <= CURDATE()
              GROUP BY fecha_envio_programada, tipo_frecuencia
              HAVING COUNT(*) > 1;
              
          DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
          
          OPEN cur_grupos;
          
          read_loop: LOOP
              FETCH cur_grupos INTO v_fecha_envio, v_tipo_frecuencia, v_count;
              IF done THEN
                  LEAVE read_loop;
              END IF;
              
              -- Crear notificación agrupada con formato legible
              INSERT INTO notificaciones_pendientes (
                  tipo_notificacion,
                  destinatario_email,
                  destinatario_nombre,
                  asunto,
                  mensaje,
                  tipo_frecuencia,
                  fecha_envio_programada,
                  estado,
                  fecha_creacion
              )
              SELECT 
                  'email',
                  'fabricio.gomez4371@gmail.com',
                  'Administrador Sistema',
                  CONCAT('📋 Resumen ', v_tipo_frecuencia, ': ', v_count, ' productos con faltantes'),
                  CONCAT(
                      '📋 RESUMEN ', UPPER(v_tipo_frecuencia), ' DE FALTANTES\n',
                      '═════════════════════════════════════════════════════════\n\n',
                      '📅 Fecha del reporte: ', DATE_FORMAT(v_fecha_envio, '%d de %M de %Y'), '\n',
                      '📊 Total de productos afectados: ', v_count, '\n\n',
                      '📦 PRODUCTOS CON FALTANTES:\n',
                      '─────────────────────────────────────────────────\n',
                      GROUP_CONCAT(
                          CONCAT(
                              '• ', 
                              -- Extraer solo el nombre del producto del asunto (sin el emoji y "Faltante:")
                              TRIM(SUBSTRING_INDEX(asunto, 'Faltante: ', -1)),
                              '\n   Cantidad faltante: ', 
                              -- Extraer cantidad del mensaje
                              TRIM(SUBSTRING_INDEX(
                                  SUBSTRING_INDEX(mensaje, 'Cantidad faltante: ', -1),
                                  ' unidades', 1
                              )), ' unidades'
                          ) 
                          SEPARATOR '\n\n'
                      ),
                      '\n\n🔔 RESUMEN EJECUTIVO:\n',
                      '─────────────────────────────────────────────\n',
                      '⚠️ Se detectaron múltiples faltantes en el inventario durante el período.\n',
                      '📈 Es recomendable revisar los niveles de stock de estos productos.\n',
                      '🔄 Considere contactar a los proveedores correspondientes.\n',
                      '📊 Revise el panel de administración para detalles específicos.\n\n',
                      '═════════════════════════════════════════════════════════\n',
                      '⏰ Reporte generado automáticamente el ', DATE_FORMAT(NOW(), '%d/%m/%Y a las %H:%i'), '\n',
                      '🏢 Sistema de gestión AXSFITT'
                  ),
                  CONCAT(v_tipo_frecuencia, '_agrupado'),
                  v_fecha_envio,
                  'pendiente',
                  NOW()
              FROM notificaciones_pendientes 
              WHERE estado = 'pendiente' 
              AND tipo_frecuencia = v_tipo_frecuencia
              AND fecha_envio_programada = v_fecha_envio;
              
              -- Marcar individuales como agrupadas
              UPDATE notificaciones_pendientes 
              SET estado = 'agrupado'
              WHERE estado = 'pendiente' 
              AND tipo_frecuencia = v_tipo_frecuencia
              AND fecha_envio_programada = v_fecha_envio;
              
          END LOOP;
          
          CLOSE cur_grupos;
      END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_procesar_notificaciones_stock` ()   BEGIN
        DECLARE done INT DEFAULT FALSE;
        DECLARE v_faltante_id INT;
        DECLARE v_producto_nombre VARCHAR(255);
        DECLARE v_stock_actual INT;
        DECLARE v_stock_minimo INT;
        DECLARE v_faltante_cantidad INT;
        DECLARE v_contacto_id INT;
        DECLARE v_contacto_email VARCHAR(255);
        DECLARE v_contacto_nombre VARCHAR(255);
        DECLARE v_asunto VARCHAR(255);
        DECLARE v_mensaje TEXT;
        
        -- Cursor para faltantes
        DECLARE faltantes_cursor CURSOR FOR 
            SELECT faltante_id, producto_nombre, stock_actual, stock_minimo, faltante_cantidad_faltante
            FROM v_faltantes_notificacion
            WHERE faltante_estado = 'detectado';
            
        -- Cursor para contactos activos
        DECLARE contactos_cursor CURSOR FOR
            SELECT contacto_id, contacto_email, contacto_nombre
            FROM notificaciones_contactos 
            WHERE contacto_activo = 1;
            
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
        
        -- Abrir cursor de faltantes
        OPEN faltantes_cursor;
        
        faltantes_loop: LOOP
            FETCH faltantes_cursor INTO v_faltante_id, v_producto_nombre, v_stock_actual, v_stock_minimo, v_faltante_cantidad;
            
            IF done THEN
                LEAVE faltantes_loop;
            END IF;
            
            -- Preparar mensaje
            SET v_asunto = CONCAT('ALERTA: Stock bajo - ', v_producto_nombre);
            SET v_mensaje = CONCAT(
                'Se ha detectado stock bajo en el siguiente producto:', CHAR(10), CHAR(10),
                'Producto: ', v_producto_nombre, CHAR(10),
                'Stock actual: ', v_stock_actual, CHAR(10),
                'Stock mínimo: ', v_stock_minimo, CHAR(10),
                'Cantidad faltante: ', v_faltante_cantidad, CHAR(10), CHAR(10),
                'Se recomienda realizar un pedido lo antes posible.', CHAR(10), CHAR(10),
                'Sistema de Gestión AXSFITT'
            );
            
            -- Insertar notificaciones para cada contacto
            SET done = FALSE;
            OPEN contactos_cursor;
            
            contactos_loop: LOOP
                FETCH contactos_cursor INTO v_contacto_id, v_contacto_email, v_contacto_nombre;
                
                IF done THEN
                    LEAVE contactos_loop;
                END IF;
                
                -- Insertar en tabla de notificaciones para envío
                INSERT INTO notificaciones_pendientes (
                    tipo_notificacion,
                    destinatario_email,
                    destinatario_nombre,
                    asunto,
                    mensaje,
                    faltante_id,
                    fecha_creacion,
                    estado
                ) VALUES (
                    'email',
                    v_contacto_email,
                    v_contacto_nombre,
                    v_asunto,
                    v_mensaje,
                    v_faltante_id,
                    NOW(),
                    'pendiente'
                );
                
            END LOOP contactos_loop;
            CLOSE contactos_cursor;
            SET done = FALSE;
            
            -- Marcar faltante como procesado para notificaciones
            UPDATE faltantes 
            SET faltante_estado = 'registrado'
            WHERE faltante_id = v_faltante_id;
            
        END LOOP faltantes_loop;
        CLOSE faltantes_cursor;
        
        -- Retornar estadísticas
        SELECT 
            (SELECT COUNT(*) FROM notificaciones_pendientes WHERE estado = 'pendiente') as notificaciones_creadas,
            (SELECT COUNT(*) FROM faltantes WHERE faltante_estado = 'registrado') as faltantes_procesados;
            
    END$$

DELIMITER ;

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
(2, 4, 'Sabor');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categorias`
--

CREATE TABLE `categorias` (
  `categoria_id` int(10) UNSIGNED NOT NULL,
  `categoria_padre_id` int(10) UNSIGNED DEFAULT NULL,
  `categoria_nombre` varchar(100) NOT NULL,
  `categoria_descripcion` text DEFAULT NULL,
  `categoria_orden` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` (`categoria_id`, `categoria_padre_id`, `categoria_nombre`, `categoria_descripcion`, `categoria_orden`) VALUES
(1, NULL, 'Proteínas', NULL, 1),
(2, NULL, 'Creatinas', NULL, 2),
(3, 1, 'Star', NULL, 1),
(4, 2, 'Star', NULL, 1),
(5, 1, 'Xbody Evolution', NULL, 2),
(6, 2, 'Xbody Evolution', NULL, 2);

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

--
-- Volcado de datos para la tabla `clientes`
--

INSERT INTO `clientes` (`cliente_id`, `persona_id`, `cliente_email`, `cliente_password`, `cliente_google_id`, `cliente_fecha_alta`, `cliente_fecha_baja`) VALUES
(1, 2, 'pedro@gmail.com', NULL, NULL, '2025-11-06 22:00:12', NULL);

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
  `faltante_id` int(10) UNSIGNED NOT NULL,
  `faltante_producto_id` int(10) UNSIGNED DEFAULT NULL,
  `faltante_variante_id` int(10) UNSIGNED DEFAULT NULL,
  `faltante_fecha_deteccion` timestamp NOT NULL DEFAULT current_timestamp(),
  `faltante_cantidad_original` int(10) UNSIGNED NOT NULL,
  `faltante_cantidad_faltante` int(10) UNSIGNED NOT NULL,
  `faltante_cantidad_solicitada` int(10) UNSIGNED DEFAULT 0,
  `faltante_estado` enum('detectado','registrado','solicitado_parcial','solicitado_completo','pedido_generado','en_transito','resuelto') DEFAULT 'detectado',
  `faltante_pedido_id` int(10) UNSIGNED DEFAULT NULL,
  `faltante_resuelto` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `faltantes`
--

INSERT INTO `faltantes` (`faltante_id`, `faltante_producto_id`, `faltante_variante_id`, `faltante_fecha_deteccion`, `faltante_cantidad_original`, `faltante_cantidad_faltante`, `faltante_cantidad_solicitada`, `faltante_estado`, `faltante_pedido_id`, `faltante_resuelto`) VALUES
(47, NULL, 2, '2025-11-07 04:35:05', 8, 12, 0, 'resuelto', NULL, 1),
(48, NULL, 1, '2025-11-07 07:49:30', 11, 7, 0, 'resuelto', NULL, 1),
(49, NULL, 1, '2025-11-07 07:54:05', 11, 7, 0, 'resuelto', NULL, 1),
(50, NULL, 1, '2025-11-10 07:39:05', 11, 7, 0, 'resuelto', NULL, 1),
(51, NULL, 1, '2025-11-10 07:46:19', 11, 8, 0, 'resuelto', NULL, 1),
(53, NULL, 1, '2025-11-10 08:01:51', 11, 8, 0, 'resuelto', NULL, 1),
(71, NULL, 1, '2025-11-13 22:53:33', 11, 8, 0, 'resuelto', NULL, 1),
(72, 2, NULL, '2025-11-13 22:56:44', 17, 33, 0, 'resuelto', NULL, 1),
(73, NULL, 1, '2025-11-14 00:18:07', 11, 8, 0, 'resuelto', NULL, 1),
(74, 2, NULL, '2025-11-14 00:22:52', 17, 33, 0, 'resuelto', NULL, 1),
(75, 2, NULL, '2025-11-14 00:50:21', 17, 33, 0, 'resuelto', NULL, 1),
(76, NULL, 1, '2025-11-14 00:55:28', 11, 8, 0, 'resuelto', NULL, 1),
(77, NULL, 2, '2025-11-14 00:55:31', 8, 12, 0, 'resuelto', NULL, 1),
(78, 2, NULL, '2025-11-14 00:55:35', 17, 33, 0, 'pedido_generado', NULL, 0),
(79, NULL, 1, '2025-11-14 06:30:21', 11, 8, 0, 'resuelto', NULL, 1),
(80, NULL, 1, '2025-11-14 06:30:21', 11, 8, 0, 'resuelto', NULL, 1),
(81, NULL, 2, '2025-11-14 06:30:21', 8, 12, 0, 'resuelto', NULL, 1),
(82, NULL, 2, '2025-11-14 06:30:21', 8, 12, 0, 'resuelto', NULL, 1),
(83, NULL, 1, '2025-11-14 06:30:35', 11, 8, 0, 'resuelto', NULL, 1),
(84, NULL, 2, '2025-11-14 06:30:35', 8, 12, 0, 'resuelto', NULL, 1),
(85, NULL, 4, '2025-11-14 07:19:36', 20, 30, 0, 'detectado', NULL, 0),
(86, NULL, 5, '2025-11-14 07:19:51', 15, 35, 0, 'detectado', NULL, 0);

--
-- Disparadores `faltantes`
--
DELIMITER $$
CREATE TRIGGER `trg_notificacion_faltante_completo` AFTER INSERT ON `faltantes` FOR EACH ROW BEGIN
          DECLARE config_activo_val INT DEFAULT 0;
          DECLARE config_frecuencia_val VARCHAR(20) DEFAULT 'inmediata';
          DECLARE config_hora_envio_val TIME DEFAULT '09:00:00';
          
          DECLARE producto_nombre_completo VARCHAR(800) DEFAULT '';
          DECLARE fecha_envio_calculada DATE DEFAULT NULL;
          DECLARE mensaje_detallado TEXT DEFAULT '';
          DECLARE asunto_legible VARCHAR(255) DEFAULT '';
          
          -- Obtener configuración de notificaciones
          SELECT config_activo, IFNULL(config_frecuencia, 'inmediata'), 
                 IFNULL(config_hora_envio, '09:00:00')
          INTO config_activo_val, config_frecuencia_val, config_hora_envio_val
          FROM notificaciones_config 
          WHERE config_tipo = 'email' AND config_activo = 1
          LIMIT 1;
          
          -- Solo procesar si las notificaciones están activas
          IF config_activo_val = 1 THEN
              
              -- OBTENER NOMBRE COMPLETO DEL PRODUCTO CON VARIANTE
              IF NEW.faltante_variante_id IS NOT NULL THEN
                  -- Producto con variante: "Whey Protein - Sabor: Vainilla"
                  SELECT 
                      CONCAT(
                          TRIM(p.producto_nombre),
                          ' - ',
                          GROUP_CONCAT(
                              CONCAT(a.atributo_nombre, ': ', vv.valor_nombre) 
                              SEPARATOR ', '
                          )
                      )
                  INTO producto_nombre_completo
                  FROM variantes v
                  LEFT JOIN productos p ON v.producto_id = p.producto_id
                  LEFT JOIN valores_variantes vv ON v.variante_id = vv.variante_id
                  LEFT JOIN atributos a ON vv.atributo_id = a.atributo_id
                  WHERE v.variante_id = NEW.faltante_variante_id
                  GROUP BY v.variante_id;
                  
              ELSEIF NEW.faltante_producto_id IS NOT NULL THEN
                  -- Producto sin variante: solo nombre del producto
                  SELECT TRIM(producto_nombre) 
                  INTO producto_nombre_completo
                  FROM productos 
                  WHERE producto_id = NEW.faltante_producto_id;
              END IF;
              
              -- Si no se pudo obtener nombre, usar descripción genérica
              IF producto_nombre_completo IS NULL OR producto_nombre_completo = '' THEN
                  SET producto_nombre_completo = 'Producto no identificado';
              END IF;
              
              -- Calcular fecha de envío según configuración
              CASE config_frecuencia_val
                  WHEN 'inmediata' THEN
                      SET fecha_envio_calculada = CURDATE();
                  WHEN 'diaria' THEN
                      IF TIME(NOW()) <= config_hora_envio_val THEN
                          SET fecha_envio_calculada = CURDATE();
                      ELSE
                          SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL 1 DAY);
                      END IF;
                  WHEN 'semanal' THEN
                      SET fecha_envio_calculada = DATE_ADD(CURDATE(), INTERVAL (7 - WEEKDAY(CURDATE())) DAY);
                  ELSE
                      SET fecha_envio_calculada = CURDATE();
              END CASE;
              
              -- Crear asunto legible sin IDs
              SET asunto_legible = CONCAT('? Faltante: ', producto_nombre_completo);
              
              -- Crear mensaje detallado legible
              SET mensaje_detallado = CONCAT(
                  '? ALERTA DE STOCK\n',
                  '════════════════════════════════════════\n\n',
                  '? PRODUCTO AFECTADO:\n',
                  '   ', producto_nombre_completo, '\n\n',
                  '? INFORMACIÓN DEL FALTANTE:\n',
                  '   • Cantidad faltante: ', NEW.faltante_cantidad_faltante, ' unidades\n',
                  '   • Cantidad original: ', NEW.faltante_cantidad_original, ' unidades\n',
                  '   • Estado: ', UPPER(NEW.faltante_estado), '\n',
                  '   • Detectado: ', DATE_FORMAT(NEW.faltante_fecha_deteccion, '%d/%m/%Y a las %H:%i'), '\n\n',
                  '⚠️ IMPACTO:\n',
                  '   El stock de este producto ha disminuido por debajo del nivel esperado.\n',
                  '   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n',
                  '? ACCIONES RECOMENDADAS:\n',
                  '   • Verificar stock físico del producto\n',
                  '   • Revisar pedidos pendientes\n',
                  '   • Contactar al proveedor si es necesario\n',
                  '   • Actualizar niveles de stock mínimo\n\n',
                  '═══════════════════════════════════════\n',
                  '⏰ Notificación generada automáticamente por el sistema AXSFITT\n',
                  '? Para consultas, contacte al administrador del sistema.'
              );
              
              -- Insertar notificación con nombres legibles
              INSERT INTO notificaciones_pendientes (
                  tipo_notificacion,
                  destinatario_email,
                  destinatario_nombre,
                  asunto,
                  mensaje,
                  faltante_id,
                  tipo_frecuencia,
                  fecha_envio_programada,
                  estado,
                  fecha_creacion
              ) VALUES (
                  'email',
                  'fabricio.gomez4371@gmail.com',
                  'Administrador Sistema',
                  asunto_legible,
                  mensaje_detallado,
                  NEW.faltante_id,
                  config_frecuencia_val,
                  fecha_envio_calculada,
                  'pendiente',
                  NOW()
              );
              
          END IF;
      END
$$
DELIMITER ;

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
(28, 2, '/uploads/1758302581230-978212042-15.png', 0),
(29, 2, '/uploads/1758302581238-272173220-16.png', 1),
(45, 1, '/uploads/1758302499461-79695005-1.png', 0),
(46, 1, '/uploads/1758302499473-419007522-2.png', 1),
(47, 1, '/uploads/1758302499482-797443712-4.png', 2),
(56, 4, '/uploads/1763104123250-991007126-1.png', 0),
(57, 4, '/uploads/1763104123263-143145649-2.png', 1),
(58, 4, '/uploads/1763104545127-740036365-3.png', 2),
(59, 4, '/uploads/1763104123272-380855050-4.png', 3);

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
-- Estructura de tabla para la tabla `log_triggers`
--

CREATE TABLE `log_triggers` (
  `id` int(11) NOT NULL,
  `tabla` varchar(50) NOT NULL,
  `accion` varchar(50) NOT NULL,
  `detalles` text DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `log_triggers`
--

INSERT INTO `log_triggers` (`id`, `tabla`, `accion`, `detalles`, `fecha`) VALUES
(1, 'pedidos_detalle', 'INSERT', 'Procesando detalle pedido ID: 3 - Producto: N/A - Variante: 4 - Cantidad: 5', '2025-11-14 07:12:30'),
(2, 'pedidos_detalle', 'INSERT', 'Procesando detalle pedido ID: 4 - Producto: N/A - Variante: 5 - Cantidad: 5', '2025-11-14 07:12:30'),
(3, 'pedidos', 'UPDATE_ESTADO', 'Pedido ID: 2 cambió de estado: pendiente -> completo', '2025-11-14 07:14:55');

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
-- Estructura de tabla para la tabla `notificaciones_config`
--

CREATE TABLE `notificaciones_config` (
  `config_id` int(10) UNSIGNED NOT NULL,
  `config_usuario_id` int(10) UNSIGNED NOT NULL,
  `config_tipo` enum('email','whatsapp','sms') NOT NULL,
  `config_activo` tinyint(1) DEFAULT 1,
  `config_fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `config_fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `config_frecuencia` enum('inmediata','diaria','semanal') DEFAULT 'inmediata',
  `config_hora_envio` time DEFAULT '09:00:00',
  `config_dias_semana` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '["1"]' COMMENT 'Array de días de la semana (1=Lunes, 7=Domingo)' CHECK (json_valid(`config_dias_semana`)),
  `config_plantilla_personalizada` text DEFAULT NULL COMMENT 'Plantilla personalizada de mensaje'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `notificaciones_config`
--

INSERT INTO `notificaciones_config` (`config_id`, `config_usuario_id`, `config_tipo`, `config_activo`, `config_fecha_creacion`, `config_fecha_actualizacion`, `config_frecuencia`, `config_hora_envio`, `config_dias_semana`, `config_plantilla_personalizada`) VALUES
(1, 1, 'email', 1, '2025-11-06 18:28:41', '2025-11-14 07:19:18', 'inmediata', '22:00:00', '[\"4\"]', 'Notificacion diaria de prueba'),
(3, 1, 'whatsapp', 0, '2025-11-07 05:44:29', '2025-11-07 05:48:57', 'inmediata', '09:00:00', '[\"1\",\"2\",\"3\",\"4\",\"5\"]', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notificaciones_contactos`
--

CREATE TABLE `notificaciones_contactos` (
  `contacto_id` int(11) NOT NULL,
  `contacto_nombre` varchar(100) NOT NULL,
  `contacto_email` varchar(255) DEFAULT NULL,
  `contacto_telefono` varchar(20) DEFAULT NULL,
  `contacto_activo` tinyint(1) DEFAULT 1,
  `contacto_tipo` enum('email','whatsapp','ambos') DEFAULT 'email',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `contacto_avatar` varchar(255) DEFAULT NULL COMMENT 'URL del avatar del contacto'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `notificaciones_contactos`
--

INSERT INTO `notificaciones_contactos` (`contacto_id`, `contacto_nombre`, `contacto_email`, `contacto_telefono`, `contacto_activo`, `contacto_tipo`, `fecha_creacion`, `fecha_modificacion`, `contacto_avatar`) VALUES
(5, 'fabricio gomez', 'fabricio.gomez4371@gmail.com', '', 1, 'email', '2025-11-06 21:29:05', '2025-11-07 05:20:44', NULL),
(7, 'Pedro Martinez', 'pedro.martinez@empresa.com', '+5491187654321', 1, 'email', '2025-11-06 21:37:10', '2025-11-07 05:20:44', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notificaciones_pendientes`
--

CREATE TABLE `notificaciones_pendientes` (
  `id` int(11) NOT NULL,
  `tipo_notificacion` enum('email','whatsapp') NOT NULL,
  `destinatario_email` varchar(255) DEFAULT NULL,
  `destinatario_nombre` varchar(255) DEFAULT NULL,
  `destinatario_telefono` varchar(20) DEFAULT NULL,
  `asunto` varchar(255) DEFAULT NULL,
  `mensaje` text DEFAULT NULL,
  `faltante_id` int(11) DEFAULT NULL,
  `tipo_frecuencia` enum('inmediata','diaria','semanal','diaria_agrupado','semanal_agrupado') DEFAULT 'inmediata',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_envio` timestamp NULL DEFAULT NULL,
  `fecha_envio_programada` date DEFAULT NULL,
  `estado` enum('pendiente','enviado','error','agrupado') DEFAULT 'pendiente',
  `error_mensaje` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `notificaciones_pendientes`
--

INSERT INTO `notificaciones_pendientes` (`id`, `tipo_notificacion`, `destinatario_email`, `destinatario_nombre`, `destinatario_telefono`, `asunto`, `mensaje`, `faltante_id`, `tipo_frecuencia`, `fecha_creacion`, `fecha_envio`, `fecha_envio_programada`, `estado`, `error_mensaje`) VALUES
(23, 'email', 'fabricio.gomez4371@gmail.com', NULL, NULL, '🚨 ALERTA: Nuevo faltante detectado', 'Se ha detectado un nuevo faltante en el inventario.\n\nDetalles:\n• ID: 52\n• Cantidad faltante: 5 unidades\n• Estado: detectado\n• Fecha: 2025-11-10 04:59:38\n\nIngrese al sistema para revisar los detalles y generar pedidos.\n\nSistema AXSFITT', 52, 'inmediata', '2025-11-10 07:59:38', '2025-11-10 08:03:50', NULL, 'enviado', NULL),
(24, 'email', 'fabricio.gomez4371@gmail.com', NULL, NULL, '🚨 ALERTA: Nuevo faltante detectado', 'Se ha detectado un nuevo faltante en el inventario.\n\nDetalles:\n• ID: 53\n• Cantidad faltante: 8 unidades\n• Estado: detectado\n• Fecha: 2025-11-10 05:01:51\n\nIngrese al sistema para revisar los detalles y generar pedidos.\n\nSistema AXSFITT', 53, 'inmediata', '2025-11-10 08:01:51', '2025-11-10 08:03:54', NULL, 'enviado', NULL),
(25, 'email', 'fabricio.gomez4371@gmail.com', NULL, NULL, '🚨 STOCK BAJO: Whey Protein  - Vainilla', '🚨 ALERTA DE STOCK BAJO\n\n📦 PRODUCTO: Whey Protein  - Vainilla\n📊 CANTIDAD FALTANTE: 8 unidades\n⚠️ ESTADO: detectado\n📅 FECHA DETECCIÓN: 10/11/2025 05:16\n🔢 ID FALTANTE: 54\n\n📌 ACCIÓN REQUERIDA:\n• Revise el inventario del producto\n• Genere un pedido al proveedor si es necesario\n• Actualice el stock mínimo si corresponde\n\n🌐 Acceda al sistema para más detalles y gestionar pedidos.\n\n---\nSistema AXSFITT - Gestión de Inventario\nNotificación automática generada el 2025-11-10 05:16:08', 54, 'inmediata', '2025-11-10 08:16:08', '2025-11-10 08:16:40', '2025-11-10', 'enviado', NULL),
(26, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 diaria - Faltante: Whey Protein ', '🚨 ALERTA DE STOCK\n═══════════════════════════════════\n\n📦 PRODUCTO: Whey Protein \n📊 CANTIDAD FALTANTE: 8 unidades\n📈 CANTIDAD ORIGINAL: 25 unidades\n⚠️  ESTADO: DETECTADO\n📅 DETECTADO: 13/11/2025 a las 18:42\n\n🔍 DETALLES TÉCNICOS:\n────────────────────────────────\n🆔 ID Faltante: #56\n🏷️  ID Producto: 1\n🎯 ID Variante: N/A\n\n📋 ACCIONES RECOMENDADAS:\n────────────────────────────────\n• Verificar stock físico del producto\n• Contactar al proveedor si es necesario\n• Actualizar cantidad en el sistema\n• Revisar configuración de stock mínimo\n\n⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.\n📞 Para consultas, contacte al administrador del sistema.', 56, 'diaria', '2025-11-13 21:42:14', '2025-11-14 00:38:28', '2025-11-14', 'enviado', NULL),
(27, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 diaria - Faltante: Whey Protein ', '🚨 ALERTA DE STOCK\n═══════════════════════════════════\n\n📦 PRODUCTO: Whey Protein \n📊 CANTIDAD FALTANTE: 5 unidades\n📈 CANTIDAD ORIGINAL: 20 unidades\n⚠️  ESTADO: DETECTADO\n📅 DETECTADO: 13/11/2025 a las 18:43\n\n🔍 DETALLES TÉCNICOS:\n────────────────────────────────\n🆔 ID Faltante: #57\n🏷️  ID Producto: 1\n🎯 ID Variante: N/A\n\n📋 ACCIONES RECOMENDADAS:\n────────────────────────────────\n• Verificar stock físico del producto\n• Contactar al proveedor si es necesario\n• Actualizar cantidad en el sistema\n• Revisar configuración de stock mínimo\n\n⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.\n📞 Para consultas, contacte al administrador del sistema.', 57, 'diaria', '2025-11-13 21:43:58', NULL, '2025-11-13', 'agrupado', NULL),
(28, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 diaria - Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n═══════════════════════════════════\n\n📦 PRODUCTO: Creatina Monohidratada\n📊 CANTIDAD FALTANTE: 7 unidades\n📈 CANTIDAD ORIGINAL: 25 unidades\n⚠️  ESTADO: DETECTADO\n📅 DETECTADO: 13/11/2025 a las 18:43\n\n🔍 DETALLES TÉCNICOS:\n────────────────────────────────\n🆔 ID Faltante: #58\n🏷️  ID Producto: 2\n🎯 ID Variante: N/A\n\n📋 ACCIONES RECOMENDADAS:\n────────────────────────────────\n• Verificar stock físico del producto\n• Contactar al proveedor si es necesario\n• Actualizar cantidad en el sistema\n• Revisar configuración de stock mínimo\n\n⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.\n📞 Para consultas, contacte al administrador del sistema.', 58, 'diaria', '2025-11-13 21:43:58', NULL, '2025-11-13', 'agrupado', NULL),
(29, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 diaria - Faltante: Whey Protein ', '🚨 ALERTA DE STOCK\n═══════════════════════════════════\n\n📦 PRODUCTO: Whey Protein \n📊 CANTIDAD FALTANTE: 9 unidades\n📈 CANTIDAD ORIGINAL: 30 unidades\n⚠️  ESTADO: DETECTADO\n📅 DETECTADO: 13/11/2025 a las 18:43\n\n🔍 DETALLES TÉCNICOS:\n────────────────────────────────\n🆔 ID Faltante: #59\n🏷️  ID Producto: 1\n🎯 ID Variante: N/A\n\n📋 ACCIONES RECOMENDADAS:\n────────────────────────────────\n• Verificar stock físico del producto\n• Contactar al proveedor si es necesario\n• Actualizar cantidad en el sistema\n• Revisar configuración de stock mínimo\n\n⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.\n📞 Para consultas, contacte al administrador del sistema.', 59, 'diaria', '2025-11-13 21:43:58', NULL, '2025-11-13', 'agrupado', NULL),
(30, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 diaria - Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n═══════════════════════════════════\n\n📦 PRODUCTO: Creatina Monohidratada\n📊 CANTIDAD FALTANTE: 11 unidades\n📈 CANTIDAD ORIGINAL: 35 unidades\n⚠️  ESTADO: DETECTADO\n📅 DETECTADO: 13/11/2025 a las 18:43\n\n🔍 DETALLES TÉCNICOS:\n────────────────────────────────\n🆔 ID Faltante: #60\n🏷️  ID Producto: 2\n🎯 ID Variante: N/A\n\n📋 ACCIONES RECOMENDADAS:\n────────────────────────────────\n• Verificar stock físico del producto\n• Contactar al proveedor si es necesario\n• Actualizar cantidad en el sistema\n• Revisar configuración de stock mínimo\n\n⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.\n📞 Para consultas, contacte al administrador del sistema.', 60, 'diaria', '2025-11-13 21:43:58', NULL, '2025-11-13', 'agrupado', NULL),
(31, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '📋 Resumen diaria de faltantes (4 productos)', '📋 RESUMEN DE FALTANTES - DIARIA\n═══════════════════════════════════════\n📅 Fecha del reporte: 13/11/2025\n📊 Total de productos con faltantes: 4\n\n📦 DETALLE DE FALTANTES:\n────────────────────────────\n• Whey Protein  - CANTIDAD FALTANTE: 5 unidades\n• Creatina Monohidratada - CANTIDAD FALTANTE: 7 unidades\n• Whey Protein  - CANTIDAD FALTANTE: 9 unidades\n• Creatina Monohidratada - CANTIDAD FALTANTE: 11 unidades\n\n⚠️ Es necesario revisar el stock de estos productos.\n🔄 Reporte generado automáticamente por el sistema.\n📧 Para más detalles, revise el panel de administración.', NULL, 'diaria_agrupado', '2025-11-13 21:43:59', '2025-11-13 21:44:03', '2025-11-13', 'enviado', NULL),
(32, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 inmediata - Faltante: Whey Protein ', '🚨 ALERTA DE STOCK\n═══════════════════════════════════\n\n📦 PRODUCTO: Whey Protein \n📊 CANTIDAD FALTANTE: 3 unidades\n📈 CANTIDAD ORIGINAL: 15 unidades\n⚠️  ESTADO: DETECTADO\n📅 DETECTADO: 13/11/2025 a las 18:44\n\n🔍 DETALLES TÉCNICOS:\n────────────────────────────────\n🆔 ID Faltante: #61\n🏷️  ID Producto: 1\n🎯 ID Variante: N/A\n\n📋 ACCIONES RECOMENDADAS:\n────────────────────────────────\n• Verificar stock físico del producto\n• Contactar al proveedor si es necesario\n• Actualizar cantidad en el sistema\n• Revisar configuración de stock mínimo\n\n⏰ Este mensaje fue generado automáticamente por el sistema de gestión de stock.\n📞 Para consultas, contacte al administrador del sistema.', 61, 'inmediata', '2025-11-13 21:44:03', '2025-11-13 21:44:08', '2025-11-13', 'enviado', NULL),
(33, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 5 unidades\n   • Cantidad original: 25 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:18\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 62, 'inmediata', '2025-11-13 22:18:13', '2025-11-13 22:18:23', '2025-11-13', 'enviado', NULL),
(34, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 3 unidades\n   • Cantidad original: 20 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:18\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 63, 'inmediata', '2025-11-13 22:18:13', '2025-11-13 22:18:25', '2025-11-13', 'enviado', NULL),
(35, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 50 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:23\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 64, 'inmediata', '2025-11-13 22:23:28', '2025-11-13 22:23:32', '2025-11-13', 'enviado', NULL),
(36, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Creatina Monohidratada\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 5 unidades\n   • Cantidad original: 30 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:23\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 65, 'inmediata', '2025-11-13 22:23:28', '2025-11-13 22:23:35', '2025-11-13', 'enviado', NULL),
(37, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 15 unidades\n   • Cantidad original: 100 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:36\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 66, 'inmediata', '2025-11-13 22:36:59', '2025-11-13 22:37:04', '2025-11-13', 'enviado', NULL),
(38, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Creatina Monohidratada\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 12 unidades\n   • Cantidad original: 80 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:36\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 67, 'inmediata', '2025-11-13 22:36:59', '2025-11-13 22:37:07', '2025-11-13', 'enviado', NULL),
(39, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Frutilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Frutilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 75 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:36\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 68, 'diaria', '2025-11-13 22:36:59', NULL, '2025-11-13', 'agrupado', NULL),
(40, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Creatina Monohidratada\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 5 unidades\n   • Cantidad original: 60 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:36\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 69, 'diaria', '2025-11-13 22:36:59', NULL, '2025-11-13', 'agrupado', NULL),
(41, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 18 unidades\n   • Cantidad original: 90 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:36\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 70, 'diaria', '2025-11-13 22:36:59', NULL, '2025-11-13', 'agrupado', NULL),
(42, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '📋 Resumen diaria: 3 productos con faltantes', '📋 RESUMEN DIARIA DE FALTANTES\n═════════════════════════════════════════════════════════\n\n📅 Fecha del reporte: 13 de November de 2025\n📊 Total de productos afectados: 3\n\n📦 PRODUCTOS CON FALTANTES:\n─────────────────────────────────────────────────\n• Whey Protein - Sabor: Frutilla\n   Cantidad faltante: 8 unidades\n\n• Creatina Monohidratada\n   Cantidad faltante: 5 unidades\n\n• Whey Protein - Sabor: Vainilla\n   Cantidad faltante: 18 unidades\n\n🔔 RESUMEN EJECUTIVO:\n─────────────────────────────────────────────\n⚠️ Se detectaron múltiples faltantes en el inventario durante el período.\n📈 Es recomendable revisar los niveles de stock de estos productos.\n🔄 Considere contactar a los proveedores correspondientes.\n📊 Revise el panel de administración para detalles específicos.\n\n═════════════════════════════════════════════════════════\n⏰ Reporte generado automáticamente el 13/11/2025 a las 19:36\n🏢 Sistema de gestión AXSFITT', NULL, 'diaria_agrupado', '2025-11-13 22:36:59', '2025-11-13 22:37:10', '2025-11-13', 'enviado', NULL),
(43, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 11 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 19:53\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 71, 'inmediata', '2025-11-13 22:53:33', '2025-11-13 22:53:46', '2025-11-13', 'enviado', NULL),
(44, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 11 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 21:18\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 73, 'diaria', '2025-11-14 00:18:07', '2025-11-14 00:36:41', '2025-11-13', 'enviado', NULL),
(45, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Creatina Monohidratada\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 33 unidades\n   • Cantidad original: 17 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 21:22\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 74, 'inmediata', '2025-11-14 00:22:52', '2025-11-14 00:22:59', '2025-11-13', 'enviado', NULL),
(46, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Creatina Monohidratada\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 33 unidades\n   • Cantidad original: 17 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 21:50\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 75, 'diaria', '2025-11-14 00:50:21', '2025-11-14 00:50:36', '2025-11-14', 'enviado', NULL),
(47, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 11 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 21:55\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 76, 'diaria', '2025-11-14 00:55:28', NULL, '2025-11-13', 'agrupado', NULL),
(48, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Frutilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Frutilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 12 unidades\n   • Cantidad original: 8 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 21:55\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 77, 'diaria', '2025-11-14 00:55:31', NULL, '2025-11-13', 'agrupado', NULL),
(49, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Creatina Monohidratada', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Creatina Monohidratada\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 33 unidades\n   • Cantidad original: 17 unidades\n   • Estado: DETECTADO\n   • Detectado: 13/11/2025 a las 21:55\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 78, 'diaria', '2025-11-14 00:55:35', NULL, '2025-11-13', 'agrupado', NULL),
(50, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '📋 Resumen diaria: 3 productos con faltantes', '📋 RESUMEN DIARIA DE FALTANTES\n═════════════════════════════════════════════════════════\n\n📅 Fecha del reporte: 13 de November de 2025\n📊 Total de productos afectados: 3\n\n📦 PRODUCTOS CON FALTANTES:\n─────────────────────────────────────────────────\n• Whey Protein - Sabor: Vainilla\n   Cantidad faltante: 8 unidades\n\n• Whey Protein - Sabor: Frutilla\n   Cantidad faltante: 12 unidades\n\n• Creatina Monohidratada\n   Cantidad faltante: 33 unidades\n\n🔔 RESUMEN EJECUTIVO:\n─────────────────────────────────────────────\n⚠️ Se detectaron múltiples faltantes en el inventario durante el período.\n📈 Es recomendable revisar los niveles de stock de estos productos.\n🔄 Considere contactar a los proveedores correspondientes.\n📊 Revise el panel de administración para detalles específicos.\n\n═════════════════════════════════════════════════════════\n⏰ Reporte generado automáticamente el 13/11/2025 a las 21:55\n🏢 Sistema de gestión AXSFITT', NULL, 'diaria_agrupado', '2025-11-14 00:55:39', '2025-11-14 00:55:42', '2025-11-13', 'enviado', NULL),
(51, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 11 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 03:30\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 79, 'diaria', '2025-11-14 06:30:21', NULL, '2025-11-14', 'agrupado', NULL),
(52, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 11 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 03:30\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 80, 'diaria', '2025-11-14 06:30:21', NULL, '2025-11-14', 'agrupado', NULL),
(53, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Frutilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Frutilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 12 unidades\n   • Cantidad original: 8 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 03:30\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 81, 'diaria', '2025-11-14 06:30:21', NULL, '2025-11-14', 'agrupado', NULL),
(54, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Frutilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Frutilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 12 unidades\n   • Cantidad original: 8 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 03:30\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 82, 'diaria', '2025-11-14 06:30:21', NULL, '2025-11-14', 'agrupado', NULL),
(55, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '📋 Resumen diaria: 4 productos con faltantes', '📋 RESUMEN DIARIA DE FALTANTES\n═════════════════════════════════════════════════════════\n\n📅 Fecha del reporte: 14 de November de 2025\n📊 Total de productos afectados: 4\n\n📦 PRODUCTOS CON FALTANTES:\n─────────────────────────────────────────────────\n• Whey Protein - Sabor: Vainilla\n   Cantidad faltante: 8 unidades\n\n• Whey Protein - Sabor: Vainilla\n   Cantidad faltante: 8 unidades\n\n• Whey Protein - Sabor: Frutilla\n   Cantidad faltante: 12 unidades\n\n• Whey Protein - Sabor: Frutilla\n   Cantidad faltante: 12 unidades\n\n🔔 RESUMEN EJECUTIVO:\n─────────────────────────────────────────────\n⚠️ Se detectaron múltiples faltantes en el inventario durante el período.\n📈 Es recomendable revisar los niveles de stock de estos productos.\n🔄 Considere contactar a los proveedores correspondientes.\n📊 Revise el panel de administración para detalles específicos.\n\n═════════════════════════════════════════════════════════\n⏰ Reporte generado automáticamente el 14/11/2025 a las 03:30\n🏢 Sistema de gestión AXSFITT', NULL, 'diaria_agrupado', '2025-11-14 06:30:28', NULL, '2025-11-14', 'pendiente', NULL),
(56, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 8 unidades\n   • Cantidad original: 11 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 03:30\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 83, 'diaria', '2025-11-14 06:30:35', NULL, '2025-11-14', 'agrupado', NULL),
(57, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Frutilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Frutilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 12 unidades\n   • Cantidad original: 8 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 03:30\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 84, 'diaria', '2025-11-14 06:30:35', NULL, '2025-11-14', 'agrupado', NULL),
(58, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '📋 Resumen diaria: 2 productos con faltantes', '📋 RESUMEN DIARIA DE FALTANTES\n═════════════════════════════════════════════════════════\n\n📅 Fecha del reporte: 14 de November de 2025\n📊 Total de productos afectados: 2\n\n📦 PRODUCTOS CON FALTANTES:\n─────────────────────────────────────────────────\n• Whey Protein - Sabor: Vainilla\n   Cantidad faltante: 8 unidades\n\n• Whey Protein - Sabor: Frutilla\n   Cantidad faltante: 12 unidades\n\n🔔 RESUMEN EJECUTIVO:\n─────────────────────────────────────────────\n⚠️ Se detectaron múltiples faltantes en el inventario durante el período.\n📈 Es recomendable revisar los niveles de stock de estos productos.\n🔄 Considere contactar a los proveedores correspondientes.\n📊 Revise el panel de administración para detalles específicos.\n\n═════════════════════════════════════════════════════════\n⏰ Reporte generado automáticamente el 14/11/2025 a las 03:30\n🏢 Sistema de gestión AXSFITT', NULL, 'diaria_agrupado', '2025-11-14 06:30:43', NULL, '2025-11-14', 'pendiente', NULL),
(59, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Vainilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Vainilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 30 unidades\n   • Cantidad original: 20 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 04:19\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 85, 'inmediata', '2025-11-14 07:19:36', '2025-11-14 07:19:42', '2025-11-14', 'enviado', NULL),
(60, 'email', 'fabricio.gomez4371@gmail.com', 'Administrador Sistema', NULL, '🚨 Faltante: Whey Protein - Sabor: Frutilla', '🚨 ALERTA DE STOCK\n════════════════════════════════════════\n\n📦 PRODUCTO AFECTADO:\n   Whey Protein - Sabor: Frutilla\n\n📊 INFORMACIÓN DEL FALTANTE:\n   • Cantidad faltante: 35 unidades\n   • Cantidad original: 15 unidades\n   • Estado: DETECTADO\n   • Detectado: 14/11/2025 a las 04:19\n\n⚠️ IMPACTO:\n   El stock de este producto ha disminuido por debajo del nivel esperado.\n   Se recomienda revisar el inventario y contactar al proveedor si es necesario.\n\n📋 ACCIONES RECOMENDADAS:\n   • Verificar stock físico del producto\n   • Revisar pedidos pendientes\n   • Contactar al proveedor si es necesario\n   • Actualizar niveles de stock mínimo\n\n═══════════════════════════════════════\n⏰ Notificación generada automáticamente por el sistema AXSFITT\n📞 Para consultas, contacte al administrador del sistema.', 86, 'inmediata', '2025-11-14 07:19:51', '2025-11-14 07:19:56', '2025-11-14', 'enviado', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos`
--

CREATE TABLE `pedidos` (
  `pedido_id` int(10) UNSIGNED NOT NULL,
  `pedido_proveedor_id` int(10) UNSIGNED NOT NULL,
  `pedido_usuario_id` int(10) UNSIGNED NOT NULL,
  `pedido_fecha_pedido` timestamp NOT NULL DEFAULT current_timestamp(),
  `pedido_fecha_esperada_entrega` date DEFAULT NULL,
  `pedido_fecha_entrega_real` date DEFAULT NULL,
  `pedido_estado` enum('pendiente','enviado','modificado','parcial','completo','cancelado') DEFAULT 'pendiente',
  `pedido_observaciones` text DEFAULT NULL,
  `pedido_total` decimal(10,2) DEFAULT NULL,
  `pedido_descuento` decimal(10,2) DEFAULT 0.00,
  `pedido_costo_envio` decimal(10,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pedidos`
--

INSERT INTO `pedidos` (`pedido_id`, `pedido_proveedor_id`, `pedido_usuario_id`, `pedido_fecha_pedido`, `pedido_fecha_esperada_entrega`, `pedido_fecha_entrega_real`, `pedido_estado`, `pedido_observaciones`, `pedido_total`, `pedido_descuento`, `pedido_costo_envio`) VALUES
(1, 2, 1, '2025-09-19 17:27:38', '2025-09-21', '2025-11-14', 'completo', NULL, 285000.00, 5.00, 10000.00),
(2, 3, 1, '2025-11-14 07:12:30', NULL, '2025-11-14', 'completo', NULL, 485000.00, 0.00, 0.00);

--
-- Disparadores `pedidos`
--
DELIMITER $$
CREATE TRIGGER `trg_pedidos_update_faltantes` AFTER UPDATE ON `pedidos` FOR EACH ROW BEGIN
            -- Solo procesar si cambió el estado del pedido
            IF OLD.pedido_estado != NEW.pedido_estado THEN
                
                INSERT INTO log_triggers (tabla, accion, detalles, fecha) 
                VALUES ('pedidos', 'UPDATE_ESTADO', 
                        CONCAT('Pedido ID: ', NEW.pedido_id, 
                               ' cambió de estado: ', OLD.pedido_estado, ' -> ', NEW.pedido_estado), 
                        NOW());
                
                -- Si el pedido fue cancelado, volver faltantes a estado detectado
                IF NEW.pedido_estado = 'cancelado' THEN
                    
                    UPDATE faltantes 
                    SET 
                        faltante_estado = 'detectado',
                        faltante_cantidad_solicitada = 0,
                        faltante_pedido_id = NULL
                    WHERE faltante_pedido_id = NEW.pedido_id;
                    
                -- Si el pedido fue completado, marcar faltantes como resueltos
                ELSEIF NEW.pedido_estado = 'completo' THEN
                    
                    UPDATE faltantes 
                    SET 
                        faltante_estado = 'resuelto',
                        faltante_resuelto = 1
                    WHERE faltante_pedido_id = NEW.pedido_id;
                    
                END IF;
                
            END IF;
        END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos_borrador_producto`
--

CREATE TABLE `pedidos_borrador_producto` (
  `pbp_id` int(10) UNSIGNED NOT NULL,
  `pbp_pedido_id` int(10) UNSIGNED NOT NULL,
  `pbp_nombre` varchar(255) NOT NULL,
  `pbp_atributos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`pbp_atributos`)),
  `pbp_variantes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`pbp_variantes`)),
  `pbp_cantidad` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `pbp_precio_unitario` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pbp_subtotal` decimal(10,2) GENERATED ALWAYS AS (`pbp_cantidad` * `pbp_precio_unitario`) STORED,
  `pbp_estado` enum('borrador','registrado') DEFAULT 'borrador',
  `pbp_fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `pbp_fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pedidos_borrador_producto`
--

INSERT INTO `pedidos_borrador_producto` (`pbp_id`, `pbp_pedido_id`, `pbp_nombre`, `pbp_atributos`, `pbp_variantes`, `pbp_cantidad`, `pbp_precio_unitario`, `pbp_estado`, `pbp_fecha_creacion`, `pbp_fecha_actualizacion`) VALUES
(1, 1, 'Whey Pro 2.0 Nutrilab', 'null', '[]', 10, 8500.00, 'registrado', '2025-09-19 17:27:38', '2025-11-14 04:10:17'),
(2, 2, 'Creatina Pura', 'null', '[]', 10, 16000.00, 'registrado', '2025-11-14 07:12:30', '2025-11-14 07:14:55');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos_detalle`
--

CREATE TABLE `pedidos_detalle` (
  `pd_id` int(10) UNSIGNED NOT NULL,
  `pd_pedido_id` int(10) UNSIGNED NOT NULL,
  `pd_producto_id` int(10) UNSIGNED DEFAULT NULL,
  `pd_variante_id` int(10) UNSIGNED DEFAULT NULL,
  `pd_cantidad_pedida` int(10) UNSIGNED NOT NULL,
  `pd_cantidad_recibida` int(10) UNSIGNED DEFAULT 0,
  `pd_precio_unitario` decimal(10,2) DEFAULT NULL,
  `pd_subtotal` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pedidos_detalle`
--

INSERT INTO `pedidos_detalle` (`pd_id`, `pd_pedido_id`, `pd_producto_id`, `pd_variante_id`, `pd_cantidad_pedida`, `pd_cantidad_recibida`, `pd_precio_unitario`, `pd_subtotal`) VALUES
(1, 1, NULL, 1, 3, 5, 21500.00, NULL),
(2, 1, NULL, 2, 2, 2, 21000.00, NULL),
(3, 2, NULL, 4, 5, 10, 12500.00, NULL),
(4, 2, NULL, 5, 5, 5, 17500.00, NULL);

--
-- Disparadores `pedidos_detalle`
--
DELIMITER $$
CREATE TRIGGER `trg_pedidos_detalle_insert_faltantes` AFTER INSERT ON `pedidos_detalle` FOR EACH ROW BEGIN
            DECLARE done INT DEFAULT FALSE;
            DECLARE v_faltante_id INT;
            DECLARE v_cantidad_faltante INT;
            DECLARE v_cantidad_solicitada_actual INT;
            DECLARE nueva_cantidad_solicitada INT;
            DECLARE nuevo_estado VARCHAR(50);
            
            -- Cursor para encontrar faltantes relacionados al detalle insertado
            DECLARE cur_faltantes CURSOR FOR
                SELECT 
                    faltante_id, 
                    faltante_cantidad_faltante, 
                    faltante_cantidad_solicitada
                FROM faltantes 
                WHERE faltante_estado IN ('detectado', 'solicitado_parcial')
                  AND (
                    (NEW.pd_producto_id IS NOT NULL AND faltante_producto_id = NEW.pd_producto_id) 
                    OR 
                    (NEW.pd_variante_id IS NOT NULL AND faltante_variante_id = NEW.pd_variante_id)
                  );
            
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
            
            -- Log del inicio del trigger
            INSERT INTO log_triggers (tabla, accion, detalles, fecha) 
            VALUES ('pedidos_detalle', 'INSERT', 
                    CONCAT('Procesando detalle pedido ID: ', NEW.pd_id, 
                           ' - Producto: ', IFNULL(NEW.pd_producto_id, 'N/A'), 
                           ' - Variante: ', IFNULL(NEW.pd_variante_id, 'N/A'),
                           ' - Cantidad: ', NEW.pd_cantidad_pedida), 
                    NOW());
            
            -- Abrir cursor y procesar faltantes
            OPEN cur_faltantes;
            
            read_loop: LOOP
                FETCH cur_faltantes INTO v_faltante_id, v_cantidad_faltante, v_cantidad_solicitada_actual;
                
                IF done THEN
                    LEAVE read_loop;
                END IF;
                
                -- Calcular nueva cantidad solicitada
                SET nueva_cantidad_solicitada = v_cantidad_solicitada_actual + NEW.pd_cantidad_pedida;
                
                -- Determinar nuevo estado
                IF nueva_cantidad_solicitada >= v_cantidad_faltante THEN
                    SET nuevo_estado = 'solicitado_completo';
                ELSE
                    SET nuevo_estado = 'solicitado_parcial';
                END IF;
                
                -- Actualizar faltante
                UPDATE faltantes 
                SET 
                    faltante_estado = nuevo_estado,
                    faltante_cantidad_solicitada = nueva_cantidad_solicitada,
                    faltante_pedido_id = NEW.pd_pedido_id
                WHERE faltante_id = v_faltante_id;
                
                -- Log de la actualización
                INSERT INTO log_triggers (tabla, accion, detalles, fecha) 
                VALUES ('faltantes', 'UPDATE_FROM_PEDIDO_INSERT', 
                        CONCAT('Faltante ID: ', v_faltante_id, 
                               ' actualizado a estado: ', nuevo_estado,
                               ' - Cantidad solicitada: ', nueva_cantidad_solicitada, '/', v_cantidad_faltante), 
                        NOW());
                
            END LOOP;
            
            CLOSE cur_faltantes;
        END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos_modificaciones`
--

CREATE TABLE `pedidos_modificaciones` (
  `pm_id` int(10) UNSIGNED NOT NULL,
  `pm_pedido_id` int(10) UNSIGNED NOT NULL,
  `pm_usuario_id` int(10) UNSIGNED NOT NULL,
  `pm_fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `pm_motivo` text NOT NULL,
  `pm_detalle_anterior` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`pm_detalle_anterior`)),
  `pm_detalle_nuevo` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`pm_detalle_nuevo`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pedidos_modificaciones`
--

INSERT INTO `pedidos_modificaciones` (`pm_id`, `pm_pedido_id`, `pm_usuario_id`, `pm_fecha_modificacion`, `pm_motivo`, `pm_detalle_anterior`, `pm_detalle_nuevo`) VALUES
(1, 1, 1, '2025-11-14 04:10:17', 'Recepción de pedido con migración automática de productos borrador', '{\"estado\":\"pendiente\"}', '{\"estado\":\"completo\",\"fecha_recepcion\":\"2025-11-14T04:10:17.035Z\",\"observaciones\":\"Trajeron 2 whey protein de sabor vainilla de mas\",\"productos_nuevos\":0}'),
(2, 2, 1, '2025-11-14 07:14:55', 'Recepción de pedido con migración automática de productos borrador', '{\"estado\":\"pendiente\"}', '{\"estado\":\"completo\",\"fecha_recepcion\":\"2025-11-14T07:14:55.802Z\",\"observaciones\":null,\"productos_nuevos\":0}');

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
(24, 1, 5, 24),
(25, 1, 5, 25),
(26, 1, 5, 26),
(27, 1, 5, 27),
(28, 1, 5, 28),
(29, 1, 5, 29),
(30, 1, 5, 30),
(31, 1, 5, 31),
(32, 1, 5, 32),
(33, 1, 5, 33),
(34, 1, 5, 34),
(35, 1, 5, 35),
(36, 1, 5, 36),
(37, 1, 5, 37),
(38, 1, 5, 38),
(39, 1, 5, 39),
(40, 1, 5, 40),
(41, 1, 5, 41),
(42, 1, 5, 42),
(43, 1, 5, 43),
(44, 1, 5, 44),
(45, 1, 6, 45),
(46, 1, 6, 46),
(47, 1, 6, 47),
(48, 1, 6, 48),
(49, 1, 7, 49),
(50, 1, 7, 50),
(51, 1, 7, 51),
(52, 1, 7, 52);

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
(23, 5, 'Ajustar Stock', NULL, 0),
(24, 5, 'Ver Movimientos de Stock', NULL, 0),
(25, 5, 'Ver Lista de Faltantes', '/productos/faltantes', 1),
(26, 5, 'Registrar Faltante', NULL, 0),
(27, 5, 'Resolver Faltante', NULL, 0),
(28, 5, 'Solicitar Reposición', NULL, 0),
(29, 5, 'Gestionar Pedidos', '/productos/pedidos', 1),
(30, 5, 'Crear Pedido', NULL, 0),
(31, 5, 'Modificar Pedido', NULL, 0),
(32, 5, 'Recibir Pedido', NULL, 0),
(33, 5, 'Cancelar Pedido', NULL, 0),
(34, 5, 'Ver Histórico Modificaciones', NULL, 0),
(35, 5, 'Actualizar Precios en Recepción', NULL, 0),
(36, 5, 'Gestionar Proveedores', '/productos/proveedores', 1),
(37, 5, 'Agregar Proveedor', NULL, 0),
(38, 5, 'Modificar Proveedor', NULL, 0),
(39, 5, 'Eliminar Proveedor', NULL, 0),
(40, 5, 'Reportes de Stock', '/productos/reportes', 1),
(41, 5, 'Ver Movimientos Históricos', NULL, 0),
(42, 5, 'Análisis de Proveedores', NULL, 0),
(43, 5, 'Ver Histórico de Precios', NULL, 0),
(44, 5, 'Análisis de Ganancias y Pérdidas', NULL, 0),
(45, 6, 'Listado de Ventas', '/ventas', 1),
(46, 6, 'Modificar Venta', NULL, 0),
(47, 6, 'Agregar Venta', '/ventas/agregar', 1),
(48, 6, 'Metricas', '/ventas/metricas', 1),
(49, 7, 'Agregar Cliente', '/ventas/clientes/agregar', 1),
(50, 7, 'Ver Clientes', '/ventas/clientes', 1),
(51, 7, 'Modificar Cliente', NULL, 0),
(52, 7, 'Eliminar Cliente', NULL, 0);

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
(1, 'Fabricio', 'Gómez', '44464371', '2002-09-30', NULL, NULL, NULL, NULL),
(2, 'Pedro', 'Sanchez', '44333222', NULL, NULL, '3704569668', '2025-11-06', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `precios_historicos`
--

CREATE TABLE `precios_historicos` (
  `ph_id` int(10) UNSIGNED NOT NULL,
  `ph_producto_id` int(10) UNSIGNED NOT NULL,
  `ph_variante_id` int(10) UNSIGNED DEFAULT NULL,
  `ph_precio_costo_anterior` decimal(10,2) DEFAULT NULL,
  `ph_precio_costo_nuevo` decimal(10,2) NOT NULL,
  `ph_precio_venta_anterior` decimal(10,2) DEFAULT NULL,
  `ph_precio_venta_nuevo` decimal(10,2) DEFAULT NULL,
  `ph_motivo` enum('recepcion_pedido','ajuste_manual','promocion','inflacion','correccion') NOT NULL,
  `ph_pedido_id` int(10) UNSIGNED DEFAULT NULL,
  `ph_usuario_id` int(10) UNSIGNED NOT NULL,
  `ph_fecha_cambio` timestamp NOT NULL DEFAULT current_timestamp(),
  `ph_observaciones` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `precios_historicos`
--

INSERT INTO `precios_historicos` (`ph_id`, `ph_producto_id`, `ph_variante_id`, `ph_precio_costo_anterior`, `ph_precio_costo_nuevo`, `ph_precio_venta_anterior`, `ph_precio_venta_nuevo`, `ph_motivo`, `ph_pedido_id`, `ph_usuario_id`, `ph_fecha_cambio`, `ph_observaciones`) VALUES
(1, 1, 1, 20000.00, 21000.00, NULL, NULL, 'recepcion_pedido', 1, 1, '2025-09-19 17:27:38', 'Cambio de precio detectado en pedido. Precio anterior: $20000.00, Precio nuevo: $21000'),
(2, 1, 2, 22000.00, 21000.00, NULL, NULL, 'recepcion_pedido', 1, 1, '2025-09-19 17:27:38', 'Cambio de precio detectado en pedido. Precio anterior: $22000.00, Precio nuevo: $21000'),
(3, 1, 1, 21000.00, 21500.00, NULL, NULL, 'recepcion_pedido', 1, 1, '2025-11-14 04:10:17', 'Actualización de precio durante recepción. Cantidad recibida: 5'),
(5, 3, NULL, NULL, 8500.00, NULL, NULL, 'recepcion_pedido', 1, 1, '2025-11-14 04:10:17', 'Migración de producto borrador: Whey Pro 2.0 Nutrilab'),
(6, 4, 4, 18000.00, 17500.00, NULL, NULL, 'recepcion_pedido', 2, 1, '2025-11-14 07:12:30', 'Cambio de precio detectado en pedido. Precio anterior: $18000.00, Precio nuevo: $17500'),
(7, 4, 5, 18000.00, 17500.00, NULL, NULL, 'recepcion_pedido', 2, 1, '2025-11-14 07:12:30', 'Cambio de precio detectado en pedido. Precio anterior: $18000.00, Precio nuevo: $17500'),
(8, 4, 4, 17500.00, 12500.00, NULL, NULL, 'recepcion_pedido', 2, 1, '2025-11-14 07:14:55', 'Actualización de precio durante recepción. Cantidad recibida: 10'),
(9, 4, 6, NULL, 15000.00, NULL, NULL, 'recepcion_pedido', 2, 1, '2025-11-14 07:14:55', 'Migración de variante borrador a variante oficial. Atributos: [{\"atributo_nombre\":\"Sabor\",\"valor_nombre\":\"Chocolate\"}]'),
(10, 5, NULL, NULL, 16000.00, NULL, NULL, 'recepcion_pedido', 2, 1, '2025-11-14 07:14:55', 'Migración de producto borrador: Creatina Pura');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `producto_id` int(10) UNSIGNED NOT NULL,
  `categoria_id` int(10) UNSIGNED DEFAULT NULL,
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
(1, 3, 'Whey Protein ', NULL, NULL, NULL, NULL, NULL, 'activo', '2025-09-19 17:22:29', NULL, 1),
(2, 4, 'Creatina Monohidratada', NULL, 22000.00, 20000.00, NULL, NULL, 'activo', '2025-09-19 17:23:09', NULL, 1),
(3, NULL, 'Whey Pro 2.0 Nutrilab', NULL, NULL, 8500.00, NULL, NULL, 'pendiente', '2025-11-14 04:10:17', NULL, 1),
(4, 5, 'Whey Protein ', NULL, NULL, NULL, NULL, NULL, 'activo', '2025-11-14 07:09:16', NULL, 1),
(5, NULL, 'Creatina Pura', NULL, NULL, 16000.00, NULL, NULL, 'pendiente', '2025-11-14 07:14:55', NULL, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `promociones`
--

CREATE TABLE `promociones` (
  `promocion_id` int(10) UNSIGNED NOT NULL,
  `categoria_id` int(10) UNSIGNED DEFAULT NULL,
  `promocion_nombre` varchar(100) NOT NULL,
  `promocion_descripcion` text DEFAULT NULL,
  `promocion_descuento_porcentaje` decimal(5,2) NOT NULL COMMENT 'Ej: 10.00 para 10%',
  `promocion_fecha_inicio` date DEFAULT NULL,
  `promocion_fecha_fin` date DEFAULT NULL,
  `promocion_activa` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proveedores`
--

CREATE TABLE `proveedores` (
  `proveedor_id` int(10) UNSIGNED NOT NULL,
  `proveedor_nombre` varchar(255) NOT NULL,
  `proveedor_contacto` varchar(255) DEFAULT NULL,
  `proveedor_email` varchar(255) DEFAULT NULL,
  `proveedor_telefono` varchar(20) DEFAULT NULL,
  `proveedor_direccion` text DEFAULT NULL,
  `proveedor_cuit` varchar(20) DEFAULT NULL,
  `proveedor_estado` enum('activo','inactivo') DEFAULT 'activo',
  `proveedor_fecha_registro` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `proveedores`
--

INSERT INTO `proveedores` (`proveedor_id`, `proveedor_nombre`, `proveedor_contacto`, `proveedor_email`, `proveedor_telefono`, `proveedor_direccion`, `proveedor_cuit`, `proveedor_estado`, `proveedor_fecha_registro`) VALUES
(1, 'Proveedor Principal S.A.', 'Juan Pérez', 'contacto@proveedorprincipal.com', '011-4567-8900', 'Av. Corrientes 1234, CABA', '30-12345678-9', 'activo', '2025-09-19 17:18:33'),
(2, 'Distribuidora Norte', 'María González', 'ventas@distribuidoranorte.com', '011-5678-9001', 'Av. Santa Fe 5678, CABA', '30-87654321-0', 'activo', '2025-09-19 17:18:33'),
(3, 'Mayorista Central', 'Carlos Rodríguez', 'pedidos@mayoristacentral.com', '011-6789-0123', 'Av. Rivadavia 9876, CABA', '30-11223344-5', 'activo', '2025-09-19 17:18:33');

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
(3, 2, NULL, 17, NULL, '2025-11-14 00:55:35', 18, 50),
(4, 1, NULL, 0, NULL, '2025-11-06 23:40:36', 0, NULL),
(8, 3, NULL, 10, NULL, '2025-11-14 04:10:17', 0, NULL),
(9, NULL, 1, 11, NULL, '2025-11-14 06:46:50', 0, NULL),
(10, NULL, 2, 8, NULL, '2025-11-14 06:46:50', 0, NULL),
(16, NULL, 4, 20, NULL, '2025-11-14 07:19:36', 25, 50),
(17, NULL, 5, 15, NULL, '2025-11-14 07:19:51', 25, 50),
(20, NULL, 6, 10, NULL, '2025-11-14 07:14:55', 0, NULL),
(21, 5, NULL, 10, NULL, '2025-11-14 07:14:55', 0, NULL),
(22, 4, NULL, 0, NULL, '2025-11-14 07:15:51', 0, NULL);

--
-- Disparadores `stock`
--
DELIMITER $$
CREATE TRIGGER `prevent_duplicate_product_stock` BEFORE INSERT ON `stock` FOR EACH ROW BEGIN
          IF NEW.variante_id IS NULL AND NEW.producto_id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM stock WHERE producto_id = NEW.producto_id AND variante_id IS NULL) THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un registro de stock para este producto';
            END IF;
          END IF;
        END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_stock_faltantes_final` AFTER UPDATE ON `stock` FOR EACH ROW BEGIN
        DECLARE faltante_existe INT DEFAULT 0;
        DECLARE debe_haber_faltante BOOLEAN DEFAULT FALSE;
        
        -- Determinar si DEBE haber faltante
        SET debe_haber_faltante = (NEW.cantidad < NEW.stock_minimo);
        
        -- Contar faltantes activos
        SELECT COUNT(*) INTO faltante_existe
        FROM faltantes 
        WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
        AND faltante_resuelto = 0;
        
        IF debe_haber_faltante AND faltante_existe = 0 THEN
          -- CREAR faltante nuevo
          INSERT INTO faltantes (
            faltante_producto_id,
            faltante_variante_id,
            faltante_cantidad_original,
            faltante_cantidad_faltante,
            faltante_estado,
            faltante_fecha_deteccion
          ) VALUES (
            NEW.producto_id,
            NEW.variante_id,
            NEW.cantidad,  -- Stock actual
            NEW.stock_maximo - NEW.cantidad,
            'detectado',
            NOW()
          );
          
        ELSEIF NOT debe_haber_faltante AND faltante_existe > 0 THEN
          -- RESOLVER faltante existente
          UPDATE faltantes 
          SET faltante_estado = 'resuelto', 
              faltante_resuelto = 1
          WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
          AND faltante_resuelto = 0;
          
        ELSEIF debe_haber_faltante AND faltante_existe > 0 THEN
          -- ACTUALIZAR faltante existente
          -- ¡IMPORTANTE! Actualizar AMBOS campos
          UPDATE faltantes 
          SET faltante_cantidad_original = NEW.cantidad,     -- SIEMPRE el stock actual
              faltante_cantidad_faltante = NEW.stock_maximo - NEW.cantidad
          WHERE (faltante_producto_id = NEW.producto_id OR faltante_variante_id = NEW.variante_id)
          AND faltante_resuelto = 0;
        END IF;
      END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `stock_movimientos`
--

CREATE TABLE `stock_movimientos` (
  `sm_id` int(10) UNSIGNED NOT NULL,
  `sm_producto_id` int(10) UNSIGNED NOT NULL,
  `sm_variante_id` int(10) UNSIGNED DEFAULT NULL,
  `sm_tipo_movimiento` enum('entrada','salida','ajuste','venta','devolucion') NOT NULL,
  `sm_cantidad` int(11) NOT NULL,
  `sm_motivo` varchar(255) DEFAULT NULL,
  `sm_pedido_id` int(10) UNSIGNED DEFAULT NULL,
  `sm_venta_id` int(10) UNSIGNED DEFAULT NULL,
  `sm_usuario_id` int(10) UNSIGNED NOT NULL,
  `sm_fecha_movimiento` timestamp NOT NULL DEFAULT current_timestamp(),
  `sm_observaciones` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `stock_movimientos`
--

INSERT INTO `stock_movimientos` (`sm_id`, `sm_producto_id`, `sm_variante_id`, `sm_tipo_movimiento`, `sm_cantidad`, `sm_motivo`, `sm_pedido_id`, `sm_venta_id`, `sm_usuario_id`, `sm_fecha_movimiento`, `sm_observaciones`) VALUES
(1, 1, 1, 'entrada', 5, 'Recepción pedido 1', 1, NULL, 1, '2025-11-14 04:10:17', NULL),
(2, 1, 2, 'entrada', 2, 'Recepción pedido 1', 1, NULL, 1, '2025-11-14 04:10:17', NULL),
(3, 4, 4, 'entrada', 10, 'Recepción pedido 2', 2, NULL, 1, '2025-11-14 07:14:55', NULL),
(4, 4, 5, 'entrada', 5, 'Recepción pedido 2', 2, NULL, 1, '2025-11-14 07:14:55', NULL);

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
(4, 2, 'Vainilla'),
(5, 2, 'Frutilla'),
(6, 2, 'Chocolate');

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
(1, 1, 45, 25000.00, 21500.00, 23000.00, NULL, 'activo'),
(2, 1, 46, 26500.00, 21000.00, NULL, NULL, 'activo'),
(4, 4, 56, 23000.00, 12500.00, NULL, NULL, 'activo'),
(5, 4, 57, 23000.00, 17500.00, NULL, NULL, 'activo'),
(6, 4, 58, 18000.00, 15000.00, 17500.00, NULL, 'activo');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `variantes_borrador`
--

CREATE TABLE `variantes_borrador` (
  `vb_id` int(10) UNSIGNED NOT NULL,
  `vb_pedido_id` int(10) UNSIGNED NOT NULL,
  `vb_producto_id` int(10) UNSIGNED NOT NULL,
  `vb_atributos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`vb_atributos`)),
  `vb_cantidad` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `vb_precio_unitario` decimal(10,2) NOT NULL DEFAULT 0.00,
  `vb_estado` enum('borrador','registrado') DEFAULT 'borrador',
  `vb_fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `variantes_borrador`
--

INSERT INTO `variantes_borrador` (`vb_id`, `vb_pedido_id`, `vb_producto_id`, `vb_atributos`, `vb_cantidad`, `vb_precio_unitario`, `vb_estado`, `vb_fecha_creacion`) VALUES
(1, 1, 1, '[{\"atributo_nombre\":\"Sabor\",\"valor_nombre\":\"Dulce de leche\"}]', 5, 20000.00, 'registrado', '2025-09-19 17:27:38'),
(2, 2, 4, '[{\"atributo_nombre\":\"Sabor\",\"valor_nombre\":\"Chocolate\"}]', 10, 15000.00, 'registrado', '2025-11-14 07:12:30');

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

--
-- Volcado de datos para la tabla `ventas`
--

INSERT INTO `ventas` (`venta_id`, `cliente_id`, `cupon_id`, `venta_fecha`, `venta_estado_pago`, `venta_estado_envio`, `venta_monto_total`, `venta_monto_descuento`, `venta_origen`, `venta_nota`) VALUES
(1, 1, NULL, '2025-11-06 22:00:12', 'abonado', 'pendiente', 53000.00, 0.00, 'Venta Manual', NULL);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `ventas_detalle`
--

INSERT INTO `ventas_detalle` (`vd_id`, `venta_id`, `producto_id`, `variante_id`, `combo_id`, `vd_cantidad`, `vd_precio_unitario`, `vd_subtotal`, `producto_nombre`, `variante_descripcion`, `combo_nombre`) VALUES
(1, 1, NULL, 2, NULL, 2, 26500.00, 53000.00, 'Whey Protein ', 'Sabor: Frutilla', NULL);

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
  ADD PRIMARY KEY (`faltante_id`),
  ADD KEY `faltante_producto_id` (`faltante_producto_id`),
  ADD KEY `faltante_variante_id` (`faltante_variante_id`),
  ADD KEY `faltante_pedido_id` (`faltante_pedido_id`);

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
-- Indices de la tabla `log_triggers`
--
ALTER TABLE `log_triggers`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `modulos`
--
ALTER TABLE `modulos`
  ADD PRIMARY KEY (`modulo_id`),
  ADD KEY `modulos_FKIndex1` (`modulo_padre_id`);

--
-- Indices de la tabla `notificaciones_config`
--
ALTER TABLE `notificaciones_config`
  ADD PRIMARY KEY (`config_id`),
  ADD UNIQUE KEY `uk_usuario_tipo` (`config_usuario_id`,`config_tipo`);

--
-- Indices de la tabla `notificaciones_contactos`
--
ALTER TABLE `notificaciones_contactos`
  ADD PRIMARY KEY (`contacto_id`),
  ADD UNIQUE KEY `unique_email` (`contacto_email`),
  ADD KEY `idx_activo_tipo` (`contacto_activo`,`contacto_tipo`);

--
-- Indices de la tabla `notificaciones_pendientes`
--
ALTER TABLE `notificaciones_pendientes`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD PRIMARY KEY (`pedido_id`),
  ADD KEY `pedido_proveedor_id` (`pedido_proveedor_id`),
  ADD KEY `pedido_usuario_id` (`pedido_usuario_id`);

--
-- Indices de la tabla `pedidos_borrador_producto`
--
ALTER TABLE `pedidos_borrador_producto`
  ADD PRIMARY KEY (`pbp_id`),
  ADD KEY `pbp_pedido_id` (`pbp_pedido_id`);

--
-- Indices de la tabla `pedidos_detalle`
--
ALTER TABLE `pedidos_detalle`
  ADD PRIMARY KEY (`pd_id`),
  ADD KEY `pd_pedido_id` (`pd_pedido_id`),
  ADD KEY `pd_producto_id` (`pd_producto_id`),
  ADD KEY `pd_variante_id` (`pd_variante_id`);

--
-- Indices de la tabla `pedidos_modificaciones`
--
ALTER TABLE `pedidos_modificaciones`
  ADD PRIMARY KEY (`pm_id`),
  ADD KEY `pm_pedido_id` (`pm_pedido_id`),
  ADD KEY `pm_usuario_id` (`pm_usuario_id`);

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
-- Indices de la tabla `precios_historicos`
--
ALTER TABLE `precios_historicos`
  ADD PRIMARY KEY (`ph_id`),
  ADD KEY `ph_producto_id` (`ph_producto_id`),
  ADD KEY `ph_variante_id` (`ph_variante_id`),
  ADD KEY `ph_pedido_id` (`ph_pedido_id`),
  ADD KEY `ph_usuario_id` (`ph_usuario_id`);

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
-- Indices de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  ADD PRIMARY KEY (`proveedor_id`);

--
-- Indices de la tabla `stock`
--
ALTER TABLE `stock`
  ADD PRIMARY KEY (`stock_id`),
  ADD UNIQUE KEY `uk_stock_variante` (`variante_id`),
  ADD KEY `producto_id` (`producto_id`),
  ADD KEY `variante_id` (`variante_id`);

--
-- Indices de la tabla `stock_movimientos`
--
ALTER TABLE `stock_movimientos`
  ADD PRIMARY KEY (`sm_id`),
  ADD KEY `sm_producto_id` (`sm_producto_id`),
  ADD KEY `sm_variante_id` (`sm_variante_id`),
  ADD KEY `sm_pedido_id` (`sm_pedido_id`),
  ADD KEY `sm_venta_id` (`sm_venta_id`),
  ADD KEY `sm_usuario_id` (`sm_usuario_id`);

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
-- Indices de la tabla `variantes_borrador`
--
ALTER TABLE `variantes_borrador`
  ADD PRIMARY KEY (`vb_id`),
  ADD KEY `vb_pedido_id` (`vb_pedido_id`),
  ADD KEY `vb_producto_id` (`vb_producto_id`);

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
  MODIFY `atributo_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `categorias`
--
ALTER TABLE `categorias`
  MODIFY `categoria_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `clientes`
--
ALTER TABLE `clientes`
  MODIFY `cliente_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  MODIFY `faltante_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=87;

--
-- AUTO_INCREMENT de la tabla `imagenes_productos`
--
ALTER TABLE `imagenes_productos`
  MODIFY `imagen_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT de la tabla `imagenes_temporales`
--
ALTER TABLE `imagenes_temporales`
  MODIFY `imagen_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `log_triggers`
--
ALTER TABLE `log_triggers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `modulos`
--
ALTER TABLE `modulos`
  MODIFY `modulo_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `notificaciones_config`
--
ALTER TABLE `notificaciones_config`
  MODIFY `config_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de la tabla `notificaciones_contactos`
--
ALTER TABLE `notificaciones_contactos`
  MODIFY `contacto_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `notificaciones_pendientes`
--
ALTER TABLE `notificaciones_pendientes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  MODIFY `pedido_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `pedidos_borrador_producto`
--
ALTER TABLE `pedidos_borrador_producto`
  MODIFY `pbp_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `pedidos_detalle`
--
ALTER TABLE `pedidos_detalle`
  MODIFY `pd_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `pedidos_modificaciones`
--
ALTER TABLE `pedidos_modificaciones`
  MODIFY `pm_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `perfiles`
--
ALTER TABLE `perfiles`
  MODIFY `perfil_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `perfiles_modulos_permisos`
--
ALTER TABLE `perfiles_modulos_permisos`
  MODIFY `pmp_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT de la tabla `permisos`
--
ALTER TABLE `permisos`
  MODIFY `permiso_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT de la tabla `personas`
--
ALTER TABLE `personas`
  MODIFY `persona_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `precios_historicos`
--
ALTER TABLE `precios_historicos`
  MODIFY `ph_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `productos`
--
ALTER TABLE `productos`
  MODIFY `producto_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `promociones`
--
ALTER TABLE `promociones`
  MODIFY `promocion_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  MODIFY `proveedor_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `stock`
--
ALTER TABLE `stock`
  MODIFY `stock_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT de la tabla `stock_movimientos`
--
ALTER TABLE `stock_movimientos`
  MODIFY `sm_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `usuario_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `variantes`
--
ALTER TABLE `variantes`
  MODIFY `variante_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `variantes_borrador`
--
ALTER TABLE `variantes_borrador`
  MODIFY `vb_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `ventas`
--
ALTER TABLE `ventas`
  MODIFY `venta_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `ventas_detalle`
--
ALTER TABLE `ventas_detalle`
  MODIFY `vd_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  ADD CONSTRAINT `faltantes_ibfk_1` FOREIGN KEY (`faltante_producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `faltantes_ibfk_2` FOREIGN KEY (`faltante_variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `faltantes_ibfk_3` FOREIGN KEY (`faltante_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
-- Filtros para la tabla `notificaciones_config`
--
ALTER TABLE `notificaciones_config`
  ADD CONSTRAINT `notificaciones_config_ibfk_1` FOREIGN KEY (`config_usuario_id`) REFERENCES `usuarios` (`usuario_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`pedido_proveedor_id`) REFERENCES `proveedores` (`proveedor_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `pedidos_ibfk_2` FOREIGN KEY (`pedido_usuario_id`) REFERENCES `usuarios` (`usuario_id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `pedidos_borrador_producto`
--
ALTER TABLE `pedidos_borrador_producto`
  ADD CONSTRAINT `pedidos_borrador_producto_ibfk_1` FOREIGN KEY (`pbp_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `pedidos_detalle`
--
ALTER TABLE `pedidos_detalle`
  ADD CONSTRAINT `pedidos_detalle_ibfk_1` FOREIGN KEY (`pd_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `pedidos_detalle_ibfk_2` FOREIGN KEY (`pd_producto_id`) REFERENCES `productos` (`producto_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `pedidos_detalle_ibfk_3` FOREIGN KEY (`pd_variante_id`) REFERENCES `variantes` (`variante_id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `pedidos_modificaciones`
--
ALTER TABLE `pedidos_modificaciones`
  ADD CONSTRAINT `pedidos_modificaciones_ibfk_1` FOREIGN KEY (`pm_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `pedidos_modificaciones_ibfk_2` FOREIGN KEY (`pm_usuario_id`) REFERENCES `usuarios` (`usuario_id`) ON UPDATE CASCADE;

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
-- Filtros para la tabla `precios_historicos`
--
ALTER TABLE `precios_historicos`
  ADD CONSTRAINT `precios_historicos_ibfk_1` FOREIGN KEY (`ph_producto_id`) REFERENCES `productos` (`producto_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `precios_historicos_ibfk_2` FOREIGN KEY (`ph_variante_id`) REFERENCES `variantes` (`variante_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `precios_historicos_ibfk_3` FOREIGN KEY (`ph_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `precios_historicos_ibfk_4` FOREIGN KEY (`ph_usuario_id`) REFERENCES `usuarios` (`usuario_id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `productos`
--
ALTER TABLE `productos`
  ADD CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`categoria_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `promociones`
--
ALTER TABLE `promociones`
  ADD CONSTRAINT `promociones_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`categoria_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `stock`
--
ALTER TABLE `stock`
  ADD CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`variante_id`) REFERENCES `variantes` (`variante_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `stock_movimientos`
--
ALTER TABLE `stock_movimientos`
  ADD CONSTRAINT `stock_movimientos_ibfk_1` FOREIGN KEY (`sm_producto_id`) REFERENCES `productos` (`producto_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movimientos_ibfk_2` FOREIGN KEY (`sm_variante_id`) REFERENCES `variantes` (`variante_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movimientos_ibfk_3` FOREIGN KEY (`sm_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movimientos_ibfk_4` FOREIGN KEY (`sm_venta_id`) REFERENCES `ventas` (`venta_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stock_movimientos_ibfk_5` FOREIGN KEY (`sm_usuario_id`) REFERENCES `usuarios` (`usuario_id`) ON UPDATE CASCADE;

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
-- Filtros para la tabla `variantes_borrador`
--
ALTER TABLE `variantes_borrador`
  ADD CONSTRAINT `variantes_borrador_ibfk_1` FOREIGN KEY (`vb_pedido_id`) REFERENCES `pedidos` (`pedido_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `variantes_borrador_ibfk_2` FOREIGN KEY (`vb_producto_id`) REFERENCES `productos` (`producto_id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
