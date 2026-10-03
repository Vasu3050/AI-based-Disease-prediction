import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { extractCookie, resetTestDb, setupTestDb, teardownTestDb } from './helpers/db';

const app = createApp();

async function registerAndLogin(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'A User', email, password: 'StrongPass123' });
  return extractCookie(res);
}

async function makeAdmin(email: string): Promise<string> {
  const cookie = await registerAndLogin(email);
  await User.updateOne({ email }, { $set: { role: 'admin' } });
  return cookie;
}

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(resetTestDb);

describe('admin', () => {
  it('requires the admin role (403 for normal users)', async () => {
    const cookie = await registerAndLogin('plain@test.local');
    const res = await request(app).get('/api/admin/overview').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('returns overview statistics for admins', async () => {
    const cookie = await makeAdmin('admin1@test.local');
    await registerAndLogin('userx@test.local');
    const res = await request(app).get('/api/admin/overview').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.users.total).toBeGreaterThanOrEqual(2);
    expect(res.body).toHaveProperty('predictionsPerDay');
  });

  it('updates user roles and disables users (who can then no longer log in)', async () => {
    const adminCookie = await makeAdmin('admin2@test.local');
    await registerAndLogin('target@test.local');
    const target = await User.findOne({ email: 'target@test.local' });

    const disable = await request(app)
      .patch(`/api/admin/users/${target!._id}`)
      .set('Cookie', adminCookie)
      .send({ disabled: true });
    expect(disable.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'target@test.local', password: 'StrongPass123' });
    expect(login.status).toBe(403);
  });

  it('prevents admins from demoting/disabling themselves', async () => {
    const adminCookie = await makeAdmin('admin3@test.local');
    const me = await User.findOne({ email: 'admin3@test.local' });
    const res = await request(app)
      .patch(`/api/admin/users/${me!._id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  it('deletes a user and all their data', async () => {
    const adminCookie = await makeAdmin('admin4@test.local');
    await registerAndLogin('victim@test.local');
    const victim = await User.findOne({ email: 'victim@test.local' });
    const res = await request(app)
      .delete(`/api/admin/users/${victim!._id}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(await User.findById(victim!._id)).toBeNull();
  });

  it('exposes model registry and system info without secrets', async () => {
    const cookie = await makeAdmin('admin5@test.local');
    const models = await request(app).get('/api/admin/models').set('Cookie', cookie);
    expect(models.status).toBe(200);
    expect(models.body).toHaveProperty('models');

    const system = await request(app).get('/api/admin/system').set('Cookie', cookie);
    expect(system.status).toBe(200);
    const raw = JSON.stringify(system.body);
    expect(raw).not.toContain('JWT_SECRET');
    expect(raw).not.toContain('LLM_API_KEY');
    expect(system.body.llm).not.toHaveProperty('apiKey');
  });

  it('records audit events for admin actions', async () => {
    const cookie = await makeAdmin('admin6@test.local');
    await registerAndLogin('another@test.local');
    const target = await User.findOne({ email: 'another@test.local' });
    await request(app)
      .patch(`/api/admin/users/${target!._id}`)
      .set('Cookie', cookie)
      .send({ disabled: true });

    const logs = await request(app).get('/api/admin/audit-logs').set('Cookie', cookie);
    expect(logs.status).toBe(200);
    const actions = logs.body.logs.map((l: { action: string }) => l.action);
    expect(actions).toContain('ADMIN_USER_UPDATED');
    // Never store lab values in audit logs
    expect(JSON.stringify(logs.body)).not.toContain('hemoglobin');
  });
});
