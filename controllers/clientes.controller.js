import { pool } from '../db.js';

// Obtener todos los clientes
export const obtenerClientes = async (req, res) => {
  try {
    const [clientes] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_fecha_alta
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_fecha_baja IS NULL
      ORDER BY p.persona_apellido, p.persona_nombre
    `);
    
    res.status(200).json(clientes);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error interno al obtener clientes.' });
  }
};

// Obtener un cliente por ID
export const obtenerClientePorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [cliente] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_fecha_alta
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_id = ? AND c.cliente_fecha_baja IS NULL
    `, [id]);
    
    if (cliente.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    
    res.status(200).json(cliente[0]);
  } catch (error) {
    console.error('Error al obtener cliente por ID:', error);
    res.status(500).json({ message: 'Error interno al obtener cliente.' });
  }
};

// Crear un nuevo cliente
export const crearCliente = async (req, res) => {
  const { 
    persona_nombre, 
    persona_apellido, 
    persona_dni, 
    persona_fecha_nac, 
    persona_domicilio,
    persona_telefono
  } = req.body;
  
  // Validar campos obligatorios
  if (!persona_nombre || !persona_apellido || !persona_dni) {
    return res.status(400).json({ 
      message: 'Nombre, apellido y DNI son campos obligatorios.' 
    });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Insertar la persona
    const [personaResult] = await conn.query(
      `INSERT INTO personas (
        persona_nombre, 
        persona_apellido, 
        persona_dni, 
        persona_fecha_nac, 
        persona_domicilio,
        persona_telefono,
        persona_fecha_alta
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
      [
        persona_nombre,
        persona_apellido,
        persona_dni,
        persona_fecha_nac || null,
        persona_domicilio || null,
        persona_telefono || null
      ]
    );
    
    const persona_id = personaResult.insertId;
    
    // 2. Crear el cliente asociado a la persona (sin email temporal)
    const [clienteResult] = await conn.query(
      `INSERT INTO clientes (
        persona_id,
        cliente_fecha_alta
      ) VALUES (?, CURRENT_TIMESTAMP)`,
      [
        persona_id
      ]
    );
    
    await conn.commit();
    
    res.status(201).json({ 
      message: 'Cliente creado exitosamente.', 
      cliente_id: clienteResult.insertId,
      persona_id
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error al crear cliente:', error);
    
    // Verificar si el error es por DNI duplicado
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('persona_dni')) {
      return res.status(400).json({ message: 'Ya existe un cliente con ese DNI.' });
    }
    
    res.status(500).json({ message: 'Error interno al crear el cliente.' });
  } finally {
    conn.release();
  }
};

// Actualizar un cliente existente
export const actualizarCliente = async (req, res) => {
  const { id } = req.params;
  const { 
    persona_nombre, 
    persona_apellido, 
    persona_dni, 
    persona_fecha_nac, 
    persona_domicilio,
    persona_telefono
  } = req.body;
  
  // Validar campos obligatorios
  if (!persona_nombre || !persona_apellido || !persona_dni) {
    return res.status(400).json({ 
      message: 'Nombre, apellido y DNI son campos obligatorios.' 
    });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Verificar que el cliente existe
    const [clienteExistente] = await conn.query(
      'SELECT persona_id FROM clientes WHERE cliente_id = ? AND cliente_fecha_baja IS NULL',
      [id]
    );
    
    if (clienteExistente.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    
    const persona_id = clienteExistente[0].persona_id;
    
    // Actualizar la persona asociada al cliente
    await conn.query(
      `UPDATE personas SET 
        persona_nombre = ?, 
        persona_apellido = ?, 
        persona_dni = ?, 
        persona_fecha_nac = ?, 
        persona_domicilio = ?,
        persona_telefono = ?
      WHERE persona_id = ?`,
      [
        persona_nombre,
        persona_apellido,
        persona_dni,
        persona_fecha_nac || null,
        persona_domicilio || null,
        persona_telefono || null,
        persona_id
      ]
    );
    
    await conn.commit();
    
    res.status(200).json({ 
      message: 'Cliente actualizado exitosamente.', 
      cliente_id: id,
      persona_id
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error al actualizar cliente:', error);
    
    // Verificar si el error es por DNI duplicado
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('persona_dni')) {
      return res.status(400).json({ message: 'Ya existe otro cliente con ese DNI.' });
    }
    
    res.status(500).json({ message: 'Error interno al actualizar el cliente.' });
  } finally {
    conn.release();
  }
};

// Eliminar un cliente (baja lógica)
export const eliminarCliente = async (req, res) => {
  const { id } = req.params;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Verificar que el cliente existe
    const [clienteExistente] = await conn.query(
      'SELECT cliente_id FROM clientes WHERE cliente_id = ? AND cliente_fecha_baja IS NULL',
      [id]
    );
    
    if (clienteExistente.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }
    
    // Realizar baja lógica
    await conn.query(
      'UPDATE clientes SET cliente_fecha_baja = CURRENT_TIMESTAMP WHERE cliente_id = ?',
      [id]
    );
    
    await conn.commit();
    
    res.status(200).json({ message: 'Cliente eliminado exitosamente.' });
  } catch (error) {
    await conn.rollback();
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ message: 'Error interno al eliminar el cliente.' });
  } finally {
    conn.release();
  }
};

// Buscar clientes
export const buscarClientes = async (req, res) => {
  try {
    const { termino } = req.query;
    
    if (!termino) {
      return res.status(400).json({ message: 'El término de búsqueda es requerido.' });
    }
    
    const [clientes] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_fecha_alta
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE 
        c.cliente_fecha_baja IS NULL AND
        (
          p.persona_nombre LIKE ? OR
          p.persona_apellido LIKE ? OR
          p.persona_dni LIKE ? OR
          CONCAT(p.persona_nombre, ' ', p.persona_apellido) LIKE ?
        )
      ORDER BY p.persona_apellido, p.persona_nombre
    `, [`%${termino}%`, `%${termino}%`, `%${termino}%`, `%${termino}%`]);
    
    res.status(200).json(clientes);
  } catch (error) {
    console.error('Error al buscar clientes:', error);
    res.status(500).json({ message: 'Error interno al buscar clientes.' });
  }
};

// Obtener clientes eliminados
export const obtenerClientesEliminados = async (req, res) => {
  try {
    const [clientes] = await pool.query(`
      SELECT 
        c.cliente_id, 
        p.persona_id,
        p.persona_nombre, 
        p.persona_apellido, 
        p.persona_dni, 
        p.persona_fecha_nac,
        p.persona_domicilio,
        p.persona_telefono,
        c.cliente_fecha_alta,
        c.cliente_fecha_baja
      FROM clientes c
      JOIN personas p ON c.persona_id = p.persona_id
      WHERE c.cliente_fecha_baja IS NOT NULL
      ORDER BY c.cliente_fecha_baja DESC
    `);
    
    res.status(200).json(clientes);
  } catch (error) {
    console.error('Error al obtener clientes eliminados:', error);
    res.status(500).json({ message: 'Error interno al obtener clientes eliminados.' });
  }
};

// Reactivar cliente
export const reactivarCliente = async (req, res) => {
  const { id } = req.params;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Verificar que el cliente existe y está eliminado
    const [clienteExistente] = await conn.query(
      'SELECT cliente_id FROM clientes WHERE cliente_id = ? AND cliente_fecha_baja IS NOT NULL',
      [id]
    );
    
    if (clienteExistente.length === 0) {
      return res.status(404).json({ message: 'Cliente eliminado no encontrado.' });
    }
    
    // Reactivar el cliente (quitar fecha de baja)
    await conn.query(
      'UPDATE clientes SET cliente_fecha_baja = NULL WHERE cliente_id = ?',
      [id]
    );
    
    await conn.commit();
    
    res.status(200).json({ message: 'Cliente reactivado exitosamente.' });
  } catch (error) {
    await conn.rollback();
    console.error('Error al reactivar cliente:', error);
    res.status(500).json({ message: 'Error interno al reactivar el cliente.' });
  } finally {
    conn.release();
  }
};