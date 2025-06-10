const validarPermisos = (permisoRequerido) => {
    return (req, res, next) => {
        // Verificar si el usuario está autenticado y tiene permisos
        const usuario = req.user; // `req.user` es cargado por el middleware `authenticate`

        if (!usuario || !usuario.permisos || !usuario.permisos.includes(permisoRequerido)) {
            return res.status(403).json({ message: 'No tienes permiso para acceder a esta página.' });
        }

        // Continuar al siguiente middleware o controlador
        next();
    };
};

export default validarPermisos;