import { Router } from 'express';
import {
  createPredictionHandler,
  explainPredictionHandler,
  getPredictionHandler,
  listPredictionsHandler,
} from '../controllers/predictionController';
import { requireAuth } from '../middleware/auth';
import { predictionLimiter } from '../middleware/rateLimit';

export const predictionsRouter = Router();

predictionsRouter.use(requireAuth);

predictionsRouter.get('/', listPredictionsHandler);
predictionsRouter.post('/', predictionLimiter, createPredictionHandler);
predictionsRouter.get('/:id', getPredictionHandler);
predictionsRouter.post('/:id/explain', predictionLimiter, explainPredictionHandler);
