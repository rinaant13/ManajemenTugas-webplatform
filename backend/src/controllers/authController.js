const bcrypt = require('bcryptjs');
const { pool, uuidv4 } = require('../models/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=22c55e&color=fff`;

    await pool.execute(
      'INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)',
      [userId, name.trim(), email.toLowerCase().trim(), hashedPassword, avatar]
    );

    const accessToken = generateAccessToken({ id: userId, email: email.toLowerCase().trim() });
    const refreshToken = generateRefreshToken({ id: userId });

    await pool.execute(
      'INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)',
      [refreshToken, userId]
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), avatar },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id });

    await pool.execute(
      'INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)',
      [refreshToken, user.id]
    );

    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, accessToken, refreshToken }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const user = users[0];

    await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    const newAccessToken = generateAccessToken({ id: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ id: user.id });
    await pool.execute(
      'INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)',
      [newRefreshToken, user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken }
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: { user: users[0] } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const fields = [];
    const values = [];

    if (name) { fields.push('name = ?'); values.push(name.trim()); }
    if (avatar) { fields.push('avatar = ?'); values.push(avatar); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    values.push(req.user.id);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const [users] = await pool.execute(
      'SELECT id, name, email, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    return res.status(200).json({ success: true, message: 'Profile updated', data: { user: users[0] } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { register, login, refresh, logout, getProfile, updateProfile };
