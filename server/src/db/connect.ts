import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);
// NOTE: Mongoose's global `sanitizeFilter` option is intentionally NOT enabled.
// In Mongoose 8 it wraps *all* operator objects (e.g. `{ $gte: date }`) in
// `$eq`, which silently breaks legitimate operator queries. NoSQL-injection
// defense is provided by (a) the strict input sanitizer middleware
// (middleware/security.ts) which strips `$`-prefixed and dotted keys from all
// user input, and (b) strict Zod schemas that reject unknown keys before any
// query is built. All filters are constructed from validated, typed values.

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', { message: err.message }));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
