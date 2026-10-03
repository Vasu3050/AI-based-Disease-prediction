import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { extractCookie, resetTestDb, setupTestDb, teardownTestDb } from './helpers/db';

const app = createApp();

const USER = { name: 'Test User', email: 'auth@test.local', password: 'StrongPass123' };

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(resetTestDb);

describe('auth', () => {
  it('registers a user, sets an HTTP-only cookie, and returns the public user', async () => {
    const res = await request(app).post('/api/auth/register').send(USER);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(USER.email);
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('HttpOnly');
  });

  it('rejects weak passwords with details', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...USER, password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/api/auth/register').send(USER);
    const res = await request(app).post('/api/auth/register').send(USER);
    expect(res.status).toBe(409);
  });

  it('rejects unknown fields (strict schema)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...USER, role: 'admin' });
    expect(res.status).toBe(422);
  });

  it('logs in and out', async () => {
    await request(app).post('/api/auth/register').send(USER);
    const login = await request(app).post('/api/auth/login').send({ email: USER.email, password: USER.password });
    expect(login.status).toBe(200);
    const cookie = extractCookie(login);

    const me = await request(app).get('/api/users/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(USER.email);

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
  });

  it('rejects wrong credentials without revealing which part was wrong', async () => {
    await request(app).post('/api/auth/register').send(USER);
    const res = await request(app).post('/api/auth/login').send({ email: USER.email, password: 'WrongPass123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('blocks unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });

  it('changes the password and invalidates the old one', async () => {
    await request(app).post('/api/auth/register').send(USER);
    const login = await request(app).post('/api/auth/login').send({ email: USER.email, password: USER.password });
    const cookie = extractCookie(login);

    const change = await request(app)
      .post('/api/users/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: USER.password, newPassword: 'NewStrongPass456' });
    expect(change.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: USER.email, password: USER.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: USER.email, password: 'NewStrongPass456' });
    expect(newLogin.status).toBe(200);
  });
});
