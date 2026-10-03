import { Router } from 'express';
import {
  compareReportsHandler,
  createReportHandler,
  deleteReportHandler,
  getReportHandler,
  listReportsHandler,
  trendsHandler,
} from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get('/', listReportsHandler);
reportsRouter.get('/trends', trendsHandler);
reportsRouter.post('/', createReportHandler);
reportsRouter.post('/compare', compareReportsHandler);
reportsRouter.get('/:id', getReportHandler);
reportsRouter.delete('/:id', deleteReportHandler);
