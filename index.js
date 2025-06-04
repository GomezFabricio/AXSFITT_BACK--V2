import dotenv from 'dotenv'; 
dotenv.config(); // Carga las variables de entorno

import express from 'express';
import cors from 'cors';
import { PORT, SECRET_KEY } from './config.js'; // Importa SECRET_KEY para mostrarla
import loginRoutes from './routes/login.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import modulosRoutes from './routes/modulos.routes.js';
import perfilesRoutes from './routes/perfiles.routes.js';
import CategoriasRoutes from './routes/categorias.routes.js';

console.log('SECRET_KEY utilizada por el backend:', SECRET_KEY); // Log temporal para depuración

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/login', loginRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/modulos', modulosRoutes);
app.use('/api/perfiles', perfilesRoutes);
app.use('/api/categorias', CategoriasRoutes);

app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente');
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});