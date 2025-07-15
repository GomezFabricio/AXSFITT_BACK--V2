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
import ClientesRoutesRefactorizado from './routes/clientes.routes.refactorizado.js';
import VentasRoutes from './routes/ventas.routes.js';

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
app.use('/api/clientes-v2', ClientesRoutesRefactorizado); // Nueva versión refactorizada
app.use('/api/ventas', VentasRoutes);

app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente');
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});