import { Router } from 'express';
import { bloodTestsCatalog, llmStatus, modelStatus } from '../controllers/metaController';

export const metaRouter = Router();

metaRouter.get('/blood-tests', bloodTestsCatalog);
metaRouter.get('/llm', llmStatus);
metaRouter.get('/models', modelStatus);
