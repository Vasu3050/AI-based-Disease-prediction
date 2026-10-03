import { Router } from 'express';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { healthRouter } from './health';
import { metaRouter } from './meta';
import { patientsRouter } from './patients';
import { predictionsRouter } from './predictions';
import { reportsRouter } from './reports';
import { usersRouter } from './users';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/predictions', predictionsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/meta', metaRouter);
