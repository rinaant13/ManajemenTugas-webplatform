const { pool, uuidv4 } = require('../models/database');

function toMysqlDate(val) {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [d, m, y] = val.split('/');
    return `${y}-${m}-${d}`;
  }
  try {
    const d = new Date(val);
    if (isNaN(d)) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

const getAllProjects = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = 'SELECT * FROM projects WHERE user_id = ?';
    const params = [req.user.id];

    if (status) { query += ' AND status = ?'; params.push(status); }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY created_at DESC';

    const [projects] = await pool.execute(query, params);

    const projectsWithStats = await Promise.all(projects.map(async (project) => {
      const [taskRows] = await pool.execute(
        `SELECT COUNT(*) as total, SUM(status = 'completed') as completed FROM tasks WHERE project_id = ?`,
        [project.id]
      );
      const total = Number(taskRows[0].total);
      const completed = Number(taskRows[0].completed);
      return {
        ...project,
        taskCount: total,
        completedCount: completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    }));

    return res.status(200).json({
      success: true,
      data: { projects: projectsWithStats, total: projectsWithStats.length }
    });
  } catch (error) {
    console.error('getAllProjects error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const [projects] = await pool.execute(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const project = projects[0];

    const [tasks] = await pool.execute('SELECT * FROM tasks WHERE project_id = ?', [project.id]);
    const parsedTasks = tasks.map(t => ({
      ...t,
      tags: t.tags ? (typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags) : [],
      dueDate: t.due_date || null
    }));

    const completedCount = parsedTasks.filter(t => t.status === 'completed').length;

    return res.status(200).json({
      success: true,
      data: {
        project: {
          ...project,
          tasks: parsedTasks,
          taskCount: parsedTasks.length,
          completedCount,
          progress: parsedTasks.length > 0 ? Math.round((completedCount / parsedTasks.length) * 100) : 0
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const createProject = async (req, res) => {
  try {
    const { name, description, color = '#6B9071', deadline, status = 'planning' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const validStatuses = ['planning', 'in_progress', 'completed', 'on_hold'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO projects (id, user_id, name, description, color, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, name.trim(), description ? description.trim() : '', color, status, toMysqlDate(deadline)]
    );

    const [rows] = await pool.execute('SELECT * FROM projects WHERE id = ?', [id]);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { project: { ...rows[0], taskCount: 0, completedCount: 0, progress: 0 } }
    });
  } catch (error) {
    console.error('createProject error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateProject = async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { name, description, color, deadline, status } = req.body;
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description.trim()); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color); }
    if (deadline !== undefined) { fields.push('deadline = ?'); values.push(toMysqlDate(deadline)); }
    if (status !== undefined) {
      if (!['planning','in_progress','completed','on_hold'].includes(status))
        return res.status(400).json({ success: false, message: 'Invalid status' });
      fields.push('status = ?'); values.push(status);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    values.push(req.params.id, req.user.id);
    await pool.execute(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    const [taskRows] = await pool.execute(
      `SELECT COUNT(*) as total, SUM(status = 'completed') as completed FROM tasks WHERE project_id = ?`,
      [req.params.id]
    );
    const total = Number(taskRows[0].total);
    const completed = Number(taskRows[0].completed);

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: {
        project: {
          ...rows[0],
          taskCount: total,
          completedCount: completed,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('updateProject error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteProject = async (req, res) => {
  try {
    await pool.execute(
      'UPDATE tasks SET project_id = NULL WHERE project_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    const [result] = await pool.execute(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    return res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAllProjects, getProjectById, createProject, updateProject, deleteProject };
