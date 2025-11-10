import dotenv from 'dotenv'; 
dotenv.config(); // Carga las variables de entorno

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PORT, SECRET_KEY } from './config.js'; // Importa SECRET_KEY para mostrarla
import loginRoutes from './routes/login.routes.js';
import usuariosRoutesRefactorizado from './routes/usuarios.routes.refactorizado.js';
import modulosRoutes from './routes/modulos.routes.js';
import perfilesRoutes from './routes/perfiles.routes.js';
import CategoriasRoutesRefactorizado from './routes/categorias.routes.refactorizado.js';
import ProductosRoutes from './routes/productos.routes.js';
import ProductosRoutesRefactorizado from './routes/productos.routes.refactorizado.js';
import StockRoutes from './routes/stock.routes.js';
import StockRoutesRefactorizado from './routes/stock.routes.refactorizado.js';
import ClientesRoutesRefactorizado from './routes/clientes.routes.refactorizado.js';
import VentasRoutes from './routes/ventas.routes.js';
import VentasRoutesRefactorizado from './routes/ventas.routes.refactorizado.js';
import ProveedoresRoutesRefactorizado from './routes/proveedores.routes.refactorizado.js';
import PedidosRoutesRefactorizado from './routes/pedidos.routes.refactorizado.js';
import NotificacionesRoutes from './routes/notificaciones.routes.js';
import NotificacionesStockService from './services/notificaciones-stock.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('SECRET_KEY utilizada por el backend:', SECRET_KEY); // Log temporal para depuración

const app = express();

app.use(cors());
app.use(express.json());

// Middleware para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/login', loginRoutes);
app.use('/api/usuarios-v2', usuariosRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/modulos', modulosRoutes);
app.use('/api/perfiles', perfilesRoutes);
app.use('/api/categorias-v2', CategoriasRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/productos', ProductosRoutes);
app.use('/api/productos-v2', ProductosRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/stock', StockRoutes);
app.use('/api/stock-v2', StockRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/clientes-v2', ClientesRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/ventas', VentasRoutes);
app.use('/api/ventas-v2', VentasRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/proveedores-v2', ProveedoresRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/pedidos-v2', PedidosRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/notificaciones', NotificacionesRoutes); // Gestión de notificaciones

app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente');
});

// Endpoint manual para enviar notificaciones de stock
app.post('/api/enviar-notificaciones-stock', async (req, res) => {
    try {
        const resultado = await NotificacionesStockService.procesarNotificaciones();
        res.json({
            message: 'Notificaciones enviadas exitosamente',
            data: resultado
        });
    } catch (error) {
        console.error('Error enviando notificaciones:', error);
        res.status(500).json({ error: 'Error al enviar notificaciones' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('\n🔔 Sistema de notificaciones de stock activado');
    console.log('📧 Para enviar notificaciones manualmente: POST /api/enviar-notificaciones-stock');
    console.log('📊 Para ver estadísticas: GET /api/stock-v2/notificaciones/estadisticas');
    
    // Enviar notificaciones inicial después de 5 segundos
    setTimeout(async () => {
        try {
            console.log('\n🚀 Enviando notificaciones pendientes al inicio...');
            const resultado = await NotificacionesStockService.enviarNotificacionesPendientes();
            if (resultado.enviadas > 0 || resultado.errores > 0) {
                console.log(`📊 Resultado inicial: ${resultado.enviadas} enviadas, ${resultado.errores} errores`);
            }
        } catch (error) {
            console.log('⚠️ Error en notificaciones inicial:', error.message);
        }
    }, 5000);

    // 🔄 PROCESAMIENTO AUTOMÁTICO DE NOTIFICACIONES CADA 5 MINUTOS
    setInterval(async () => {
        try {
            console.log('\n⏰ [' + new Date().toLocaleString() + '] Verificando notificaciones pendientes...');
            const resultado = await NotificacionesStockService.enviarNotificacionesPendientes();
            
            if (resultado.enviadas > 0) {
                console.log(`✅ ${resultado.enviadas} notificaciones enviadas automáticamente`);
            }
            if (resultado.errores > 0) {
                console.log(`❌ ${resultado.errores} notificaciones fallaron`);
            }
            if (resultado.enviadas === 0 && resultado.errores === 0) {
                console.log('📭 No hay notificaciones pendientes');
            }
        } catch (error) {
            console.error('💥 Error en procesamiento automático de notificaciones:', error);
        }
    }, 5 * 60 * 1000); // Cada 5 minutos (300,000 ms)

    console.log('⏲️ Procesamiento automático de notificaciones configurado (cada 5 minutos)');
});