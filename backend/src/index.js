require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const { taskRouter, projectRouter } = require('./routes/resources');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'null'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later' }
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRouter);
app.use('/api/projects', projectRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'TaskFlow API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API docs
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'TaskFlow REST API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'POST /api/auth/refresh': 'Refresh access token',
        'POST /api/auth/logout': 'Logout user',
        'GET /api/auth/profile': 'Get user profile (Protected)',
        'PUT /api/auth/profile': 'Update user profile (Protected)'
      },
      tasks: {
        'GET /api/tasks': 'Get all tasks (Protected) - query: status, priority, projectId, search, sortBy, order',
        'GET /api/tasks/:id': 'Get task by ID (Protected)',
        'POST /api/tasks': 'Create task (Protected)',
        'PUT /api/tasks/:id': 'Update task (Protected)',
        'DELETE /api/tasks/:id': 'Delete task (Protected)'
      },
      projects: {
        'GET /api/projects': 'Get all projects (Protected)',
        'GET /api/projects/:id': 'Get project by ID with tasks (Protected)',
        'POST /api/projects': 'Create project (Protected)',
        'PUT /api/projects/:id': 'Update project (Protected)',
        'DELETE /api/projects/:id': 'Delete project (Protected)'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 TaskFlow API running on http://localhost:${PORT}`);
  console.log(`📖 API Docs: http://localhost:${PORT}/api`);
  console.log(`💊 Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
