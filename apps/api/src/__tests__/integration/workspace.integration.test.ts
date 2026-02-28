import request from 'supertest';
import express, { Express } from 'express';
import {
  registerUser,
  createWorkspace,
  generateTestEmail,
  generateTestName,
  TestUser,
} from './helpers';

describe('Workspace API - Integration Tests', () => {
  let app: Express;
  let testUser: TestUser;

  beforeAll(async () => {
    app = express();
    // TODO: Inicializar app real
  });

  beforeEach(async () => {
    // Crear usuario de prueba para cada test
    testUser = await registerUser(app, {
      name: 'Test User',
      email: generateTestEmail(),
      password: 'TestPassword123!',
    });
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('POST /api/workspaces', () => {
    it('debe crear un workspace exitosamente', async () => {
      const workspaceData = {
        name: generateTestName('Test Workspace'),
        description: 'A test workspace',
      };

      const response = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send(workspaceData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(workspaceData.name);
      expect(response.body.description).toBe(workspaceData.description);
      expect(response.body.ownerId).toBe(testUser.id);
    });

    it('debe crear workspace sin descripción', async () => {
      const workspaceData = {
        name: generateTestName('Workspace No Description'),
      };

      const response = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send(workspaceData)
        .expect(201);

      expect(response.body.name).toBe(workspaceData.name);
      expect(response.body.description).toBeNull();
    });

    it('debe validar nombre requerido', async () => {
      await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({})
        .expect(400);
    });

    it('debe fallar sin autenticación', async () => {
      await request(app).post('/api/workspaces').send({ name: 'Test Workspace' }).expect(401);
    });

    it('debe crear workspace con el usuario como owner', async () => {
      const workspaceData = {
        name: generateTestName('Test Workspace Owner'),
      };

      const response = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send(workspaceData)
        .expect(201);

      expect(response.body.ownerId).toBe(testUser.id);
    });
  });

  describe('GET /api/workspaces', () => {
    it('debe listar workspaces del usuario', async () => {
      // Crear varios workspaces
      await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Workspace 1'),
      });
      await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Workspace 2'),
      });

      const response = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('debe retornar array vacío si no hay workspaces', async () => {
      const response = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('debe fallar sin autenticación', async () => {
      await request(app).get('/api/workspaces').expect(401);
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('debe obtener workspace por ID', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace Get'),
      });

      const response = await request(app)
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(workspace.id);
      expect(response.body.name).toBe(workspace.name);
    });

    it('debe retornar 404 para workspace inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .get(`/api/workspaces/${fakeId}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(404);
    });

    it('debe fallar con ID inválido', async () => {
      await request(app)
        .get('/api/workspaces/invalid-id')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(400);
    });

    it('debe fallar si usuario no tiene acceso', async () => {
      // Crear otro usuario
      const otherUser = await registerUser(app, {
        name: 'Other User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      // Crear workspace con primer usuario
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Private Workspace'),
      });

      // Intentar acceder con otro usuario
      await request(app)
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/workspaces/:id', () => {
    it('debe actualizar nombre del workspace', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Original Name'),
      });

      const newName = generateTestName('Updated Name');
      const response = await request(app)
        .patch(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ name: newName })
        .expect(200);

      expect(response.body.name).toBe(newName);
    });

    it('debe actualizar descripción del workspace', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const newDescription = 'Updated description';
      const response = await request(app)
        .patch(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ description: newDescription })
        .expect(200);

      expect(response.body.description).toBe(newDescription);
    });

    it('solo el owner debe poder actualizar', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      // Crear otro usuario
      const otherUser = await registerUser(app, {
        name: 'Other User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      // Intentar actualizar con otro usuario
      await request(app)
        .patch(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  describe('DELETE /api/workspaces/:id', () => {
    it('debe eliminar workspace exitosamente', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Workspace to Delete'),
      });

      await request(app)
        .delete(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(204);

      // Verificar que ya no existe
      await request(app)
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(404);
    });

    it('solo el owner debe poder eliminar', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const otherUser = await registerUser(app, {
        name: 'Other User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      await request(app)
        .delete(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(403);
    });
  });

  describe('POST /api/workspaces/:id/invite', () => {
    it('debe generar token de invitación', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const response = await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'MEMBER' })
        .expect(200);

      expect(response.body).toHaveProperty('inviteToken');
      expect(response.body.inviteToken).toBeTruthy();
    });

    it('debe validar rol válido', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'INVALID_ROLE' })
        .expect(400);
    });

    it('solo owner y admin pueden invitar', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const memberUser = await registerUser(app, {
        name: 'Member User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${memberUser.accessToken}`)
        .send({ role: 'MEMBER' })
        .expect(403);
    });
  });

  describe('POST /api/workspaces/join/:token', () => {
    it('debe unirse al workspace con token válido', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      // Generar invitación
      const inviteResponse = await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'MEMBER' })
        .expect(200);

      const { inviteToken } = inviteResponse.body;

      // Crear nuevo usuario
      const newUser = await registerUser(app, {
        name: 'New User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      // Unirse al workspace
      const response = await request(app)
        .post(`/api/workspaces/join/${inviteToken}`)
        .set('Authorization', `Bearer ${newUser.accessToken}`)
        .expect(200);

      expect(response.body.message).toMatch(/joined/i);
    });

    it('debe fallar con token inválido', async () => {
      const newUser = await registerUser(app, {
        name: 'New User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      await request(app)
        .post('/api/workspaces/join/invalid-token')
        .set('Authorization', `Bearer ${newUser.accessToken}`)
        .expect(400);
    });

    it('debe fallar si usuario ya es miembro', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const inviteResponse = await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'MEMBER' })
        .expect(200);

      // Intentar unirse siendo ya owner
      await request(app)
        .post(`/api/workspaces/join/${inviteResponse.body.inviteToken}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(400);
    });
  });

  describe('GET /api/workspaces/:id/members', () => {
    it('debe listar miembros del workspace', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const response = await request(app)
        .get(`/api/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('userId');
      expect(response.body[0]).toHaveProperty('role');
      expect(response.body[0].role).toBe('OWNER');
    });
  });

  describe('PATCH /api/workspaces/:id/members/:userId/role', () => {
    it('debe cambiar rol de miembro', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      // Añadir miembro
      const inviteResponse = await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'MEMBER' })
        .expect(200);

      const newUser = await registerUser(app, {
        name: 'New User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      await request(app)
        .post(`/api/workspaces/join/${inviteResponse.body.inviteToken}`)
        .set('Authorization', `Bearer ${newUser.accessToken}`)
        .expect(200);

      // Cambiar rol
      const response = await request(app)
        .patch(`/api/workspaces/${workspace.id}/members/${newUser.id}/role`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(response.body.role).toBe('ADMIN');
    });

    it('solo owner puede cambiar roles', async () => {
      // Test similar al anterior pero con usuario sin permisos
    });
  });

  describe('DELETE /api/workspaces/:id/members/:userId', () => {
    it('debe remover miembro del workspace', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      const inviteResponse = await request(app)
        .post(`/api/workspaces/${workspace.id}/invite`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ role: 'MEMBER' })
        .expect(200);

      const newUser = await registerUser(app, {
        name: 'New User',
        email: generateTestEmail(),
        password: 'TestPassword123!',
      });

      await request(app)
        .post(`/api/workspaces/join/${inviteResponse.body.inviteToken}`)
        .set('Authorization', `Bearer ${newUser.accessToken}`)
        .expect(200);

      // Remover miembro
      await request(app)
        .delete(`/api/workspaces/${workspace.id}/members/${newUser.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(204);

      // Verificar que ya no tiene acceso
      await request(app)
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${newUser.accessToken}`)
        .expect(403);
    });

    it('no se puede remover al owner', async () => {
      const workspace = await createWorkspace(app, testUser.accessToken!, {
        name: generateTestName('Test Workspace'),
      });

      await request(app)
        .delete(`/api/workspaces/${workspace.id}/members/${testUser.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(400);
    });
  });
});
