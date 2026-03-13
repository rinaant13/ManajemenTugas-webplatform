const express = require('express');
const taskRouter = express.Router();
const projectRouter = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAllTasks, getTaskById, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { getAllProjects, getProjectById, createProject, updateProject, deleteProject } = require('../controllers/projectController');

// All task routes are protected
taskRouter.use(authenticate);
taskRouter.get('/', getAllTasks);
taskRouter.get('/:id', getTaskById);
taskRouter.post('/', createTask);
taskRouter.put('/:id', updateTask);
taskRouter.delete('/:id', deleteTask);

// All project routes are protected
projectRouter.use(authenticate);
projectRouter.get('/', getAllProjects);
projectRouter.get('/:id', getProjectById);
projectRouter.post('/', createProject);
projectRouter.put('/:id', updateProject);
projectRouter.delete('/:id', deleteProject);

module.exports = { taskRouter, projectRouter };
