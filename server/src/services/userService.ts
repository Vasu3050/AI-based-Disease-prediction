import type mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { BloodReport } from '../models/BloodReport';
import { Patient } from '../models/Patient';
import { Prediction } from '../models/Prediction';
import { User } from '../models/User';

/**
 * Delete a user and ALL data linked to them (privacy requirement: full data
 * deletion). Used both by "delete my account" and admin user management.
 */
export async function deleteUserCascade(userId: string | mongoose.Types.ObjectId): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;
  await Promise.all([
    Prediction.deleteMany({ owner: user._id }),
    BloodReport.deleteMany({ owner: user._id }),
    Patient.deleteMany({ owner: user._id }),
    AuditLog.deleteMany({ actor: user._id }),
  ]);
  await user.deleteOne();
  return true;
}
