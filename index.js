import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';
import loginRoutes from './routes/login.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import modulosRoutes from './routes/modulos.routes.js';
import perfilesRoutes from './routes/perfiles.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/login', loginRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/modulos', modulosRoutes);
app.use('/api/perfiles', perfilesRoutes);

app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente');
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});