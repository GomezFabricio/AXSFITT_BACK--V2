import { SECRET_KEY } from '../config.js';
import jwt from 'jsonwebtoken';

// Función para verificar y autenticar el token
const authenticate = (req, res, next) => {
    // Obtener el token del encabezado 'Authorization'
    const token = req.headers['authorization']?.split(' ')[1];

    // Si no hay token, enviar respuesta de acceso no autorizado
    if (!token) {
        return res.status(401).json({ message: 'Acceso no autorizado. Token no proporcionado.' });
    }

    // Verificar el token
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token no válido.' });
        }

        // Almacenar el token decodificado en la solicitud para su uso posterior
        req.user = decoded;

        // Continuar al siguiente middleware o controlador
        next();
    });
};

export default authenticate;