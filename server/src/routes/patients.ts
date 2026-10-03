import { Router } from 'express';
import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from '../controllers/patientController';
import { requireAuth } from '../middleware/auth';

export const patientsRouter = Router();

patientsRouter.use(requireAuth);

patientsRouter.get('/', listPatients);
patientsRouter.post('/', createPatient);
patientsRouter.patch('/:id', updatePatient);
patientsRouter.delete('/:id', deletePatient);
