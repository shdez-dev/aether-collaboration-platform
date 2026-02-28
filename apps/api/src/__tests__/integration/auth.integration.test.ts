import request from 'supertest';
import express, { Express } from 'express';
import { generateTestEmail } from './helpers';

// TODO: Importar la app real de Express
// import app from '../../index';

describe('Auth API - Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    // TODO: Inicializar app de Express
    // app = createApp();
    app = express();
  });

  afterAll(async () => {
    // TODO: Cerrar conexiones de DB
  });

  describe('POST /api/auth/register', () => {
    it('debe registrar un nuevo usuario exitosamente', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('debe fallar con email duplicado', async () => {
      const email = generateTestEmail();
      const userData = {
        name: 'Test User',
        email,
        password: 'TestPassword123!',
      };

      // Registrar primera vez
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Intentar registrar de nuevo
      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/email.*exist/i);
    });

    it('debe validar email requerido', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('debe validar password requerido', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: generateTestEmail(),
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('debe validar formato de email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/email/i);
    });

    it('debe validar longitud mínima de password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: generateTestEmail(),
          password: 'Short1',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/password.*8/i);
    });

    it('no debe retornar el password hasheado', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.user.password).toBeUndefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('debe hacer login exitosamente con credenciales válidas', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      // Registrar usuario
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Hacer login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(userData.email);
    });

    it('debe fallar con credenciales inválidas', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/credencial/i);
    });

    it('debe fallar con password incorrecto', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      // Registrar
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Login con password incorrecto
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('debe validar email y password requeridos', async () => {
      await request(app).post('/api/auth/login').send({}).expect(400);

      await request(app).post('/api/auth/login').send({ email: 'test@example.com' }).expect(400);

      await request(app).post('/api/auth/login').send({ password: 'password' }).expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('debe refrescar tokens exitosamente', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      // Registrar
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const { refreshToken } = registerResponse.body;

      // Refrescar token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).toBeTruthy();
    });

    it('debe fallar con refresh token inválido', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('debe fallar sin refresh token', async () => {
      await request(app).post('/api/auth/refresh').send({}).expect(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('debe hacer logout exitosamente', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      // Registrar
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const { accessToken, refreshToken } = registerResponse.body;

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/logout.*success/i);
    });

    it('debe fallar sin token de autenticación', async () => {
      await request(app).post('/api/auth/logout').send({}).expect(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('debe enviar email de recuperación', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      // Registrar
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Solicitar reset
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: userData.email })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/email.*sent/i);
    });

    it('debe retornar mismo mensaje si email no existe (seguridad)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/email.*sent/i);
    });

    it('debe validar email requerido', async () => {
      await request(app).post('/api/auth/forgot-password').send({}).expect(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('debe resetear password con token válido', async () => {
      // Este test requiere generar un token válido primero
      // TODO: Implementar cuando tengamos acceso a la función de generación de tokens
    });

    it('debe fallar con token inválido', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('debe retornar usuario autenticado', async () => {
      const userData = {
        name: 'Test User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      };

      // Registrar
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const { accessToken } = registerResponse.body;

      // Obtener perfil
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(userData.email);
      expect(response.body.name).toBe(userData.name);
      expect(response.body.password).toBeUndefined();
    });

    it('debe fallar sin token de autenticación', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });

    it('debe fallar con token inválido', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
