const validarPermisos = (permisoRequerido) => {
    return (req, res, next) => {
        const usuario = req.user; // `req.user` es cargado por el middleware `authenticate`

        //console.log('Permisos del usuario:', usuario?.permisos); // Verificar los permisos cargados

        if (!usuario || !usuario.permisos || !usuario.permisos.includes(permisoRequerido)) {
            return res.status(403).json({ message: 'No tienes permiso para acceder a esta página.' });
        }

        next();
    };
};

export default validarPermisos;