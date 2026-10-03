/**
 * Shared test helpers.
 *
 * IMPORTANT: tests connect through the server's own `connectDb()` so they run
 * with exactly the same database configuration (and global Mongoose settings)
 * as production code — this keeps integration tests faithful.
 *
 * The test database defaults to `medipredict_test` on the local MongoDB and
 * can be overridden with TEST_MONGODB_URI (e.g. an in-memory MongoDB in CI).
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../../src/db/connect';

const TEST_URI =
  process.env.TEST_MONGODB_URI ??
  process.env.MONGODB_URI ??
  'mongodb://127.0.0.1:27017/medipredict_test';

export async function setupTestDb(): Promise<void> {
  await connectDb(TEST_URI);
}

export async function resetTestDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function teardownTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db?.dropDatabase().catch(() => undefined);
    await disconnectDb();
  }
}

/** Extract the auth cookie from a supertest response. */
export function extractCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  if (!raw) return '';
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => String(c).split(';')[0]).join('; ');
}
