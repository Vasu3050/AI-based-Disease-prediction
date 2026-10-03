import { Router } from 'express';
import { login, logout, register } from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

authRouter.post('/register', authLimiter, register);
authRouter.post('/login', authLimiter, login);
authRouter.post('/logout', logout);
