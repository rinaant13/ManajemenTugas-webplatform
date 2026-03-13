const { pool, uuidv4 } = require('../models/database');

// Helper: konversi tanggal apapun ke format YYYY-MM-DD untuk MySQL
function toMysqlDate(val) {
  if (!val) return null;
  // Sudah format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Format DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [d, m, y] = val.split('/');
    return `${y}-${m}-${d}`;
  }
  // ISO string atau format lain
  try {
    const d = new Date(val);
    if (isNaN(d)) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

// Helper: parse tags ke array
function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') {
    try { return JSON.parse(tags); } catch { return [tags].filter(Boolean); }
  }
  return [];
}

const getAllTasks = async (req, res) => {
  try {
    const { status, priority, projectId, search, sortBy = 'created_at', order = 'DESC' } = req.query;

    const allowedSort = ['created_at', 'due_date', 'priority', 'title', 'status'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (status) { query += ' AND status = ?'; params.push(status); }
    if (priority) { query += ' AND priority = ?'; params.push(priority); }
    if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ` ORDER BY ${safeSort} ${safeOrder}`;

    const [tasks] = await pool.execute(query, params);
    const parsedTasks = tasks.map(t => ({
      ...t,
      tags: parseTags(t.tags),
      dueDate: t.due_date ? (t.due_date instanceof Date ? t.due_date.toISOString() : t.due_date) : null
    }));

    const [statsRows] = await pool.execute(
      `SELECT
        COUNT(*) as total,
        SUM(status = 'todo') as todo,
        SUM(status = 'in_progress') as in_progress,
        SUM(status = 'completed') as completed,
        SUM(priority = 'urgent') as urgent
       FROM tasks WHERE user_id = ?`,
      [req.user.id]
    );
    const stats = {
      total: Number(statsRows[0].total),
      todo: Number(statsRows[0].todo),
      in_progress: Number(statsRows[0].in_progress),
      completed: Number(statsRows[0].completed),
      urgent: Number(statsRows[0].urgent)
    };

    return res.status(200).json({
      success: true,
      data: { tasks: parsedTasks, stats, total: parsedTasks.length }
    });
  } catch (error) {
    console.error('getAllTasks error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const t = tasks[0];
    const task = { ...t, tags: parseTags(t.tags), dueDate: t.due_date || null };
    return res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, priority = 'medium', status = 'todo', dueDate, projectId, tags } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const validStatuses = ['todo', 'in_progress', 'completed'];

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority. Use: low, medium, high, urgent' });
    }
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Use: todo, in_progress, completed' });
    }

    if (projectId) {
      const [projects] = await pool.execute(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [projectId, req.user.id]
      );
      if (projects.length === 0) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
    }

    const id = uuidv4();
    const tagsStr = JSON.stringify(parseTags(tags));
    const mysqlDate = toMysqlDate(dueDate);

    await pool.execute(
      `INSERT INTO tasks (id, user_id, project_id, title, description, priority, status, due_date, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, projectId || null, title.trim(),
       description ? description.trim() : '', priority, status, mysqlDate, tagsStr]
    );

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    const t = rows[0];
    const task = { ...t, tags: parseTags(t.tags), dueDate: t.due_date || null };

    return res.status(201).json({ success: true, message: 'Task created successfully', data: { task } });
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateTask = async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const { title, description, priority, status, dueDate, projectId, tags } = req.body;
    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description.trim()); }
    if (priority !== undefined) {
      if (!['low','medium','high','urgent'].includes(priority))
        return res.status(400).json({ success: false, message: 'Invalid priority' });
      fields.push('priority = ?'); values.push(priority);
    }
    if (status !== undefined) {
      if (!['todo','in_progress','completed'].includes(status))
        return res.status(400).json({ success: false, message: 'Invalid status' });
      fields.push('status = ?'); values.push(status);
    }
    if (dueDate !== undefined) { fields.push('due_date = ?'); values.push(toMysqlDate(dueDate)); }
    if (projectId !== undefined) { fields.push('project_id = ?'); values.push(projectId || null); }
    if (tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(parseTags(tags))); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    values.push(req.params.id, req.user.id);
    await pool.execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    const t = rows[0];
    const task = { ...t, tags: parseTags(t.tags), dueDate: t.due_date || null };

    return res.status(200).json({ success: true, message: 'Task updated successfully', data: { task } });
  } catch (error) {
    console.error('updateTask error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAllTasks, getTaskById, createTask, updateTask, deleteTask };
