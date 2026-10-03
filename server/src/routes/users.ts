import { Router } from 'express';
import {
  changeMyPassword,
  deleteMe,
  me,
  updateMe,
} from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me', me);
usersRouter.patch('/me', updateMe);
usersRouter.post('/me/password', changeMyPassword);
usersRouter.delete('/me', deleteMe);
