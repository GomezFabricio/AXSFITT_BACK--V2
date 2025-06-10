import { SECRET_KEY } from '../config.js';
import jwt from 'jsonwebtoken';
import { getUsuarioConPermisos } from '../services/usuario.service.js'; // Importar desde el servicio

const authenticate = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso no autorizado. Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const usuario = await getUsuarioConPermisos(decoded.usuario_id); // Obtener usuario y permisos desde el servicio

        //console.log('Usuario autenticado:', usuario); // Verificar los datos del usuario y permisos

        if (!usuario) {
            return res.status(401).json({ message: 'Usuario no encontrado.' });
        }

        req.user = usuario; // Guardar usuario y permisos en la solicitud
        next();
    } catch (error) {
        console.error('Error en la autenticación:', error);
        return res.status(403).json({ message: 'Token no válido.' });
    }
};

export default authenticate;