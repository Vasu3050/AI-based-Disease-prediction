import { Router } from 'express';
import {
  auditLogsHandler,
  deleteUserHandler,
  listUsersHandler,
  modelsHandler,
  overviewHandler,
  refreshModelsHandler,
  systemHandler,
  updateUserHandler,
} from '../controllers/adminController';
import { requireAuth, requireRole } from '../middleware/auth';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/overview', overviewHandler);
adminRouter.get('/users', listUsersHandler);
adminRouter.patch('/users/:id', updateUserHandler);
adminRouter.delete('/users/:id', deleteUserHandler);
adminRouter.get('/models', modelsHandler);
adminRouter.post('/models/refresh', refreshModelsHandler);
adminRouter.get('/audit-logs', auditLogsHandler);
adminRouter.get('/system', systemHandler);
