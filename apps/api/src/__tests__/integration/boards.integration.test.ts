import request from 'supertest';
import express, { Express } from 'express';
import {
  registerUser,
  createWorkspace,
  createBoard,
  generateTestName,
  TestUser,
  TestWorkspace,
} from './helpers';

describe('Boards API - Integration Tests', () => {
  let app: Express;
  let testUser: TestUser;
  let testWorkspace: TestWorkspace;

  beforeAll(() => {
    app = express();
  });

  beforeEach(async () => {
    testUser = await registerUser(app, {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    });

    testWorkspace = await createWorkspace(app, testUser.accessToken!, {
      name: generateTestName('Test Workspace'),
    });
  });

  describe('POST /api/workspaces/:workspaceId/boards', () => {
    it('debe crear board exitosamente', async () => {
      const boardData = {
        title: generateTestName('Test Board'),
        description: 'A test board',
      };

      const response = await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/boards`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send(boardData)
        .expect(201);

      expect(response.body.title).toBe(boardData.title);
      expect(response.body.workspaceId).toBe(testWorkspace.id);
    });

    it('debe validar título requerido', async () => {
      await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/boards`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/workspaces/:workspaceId/boards', () => {
    it('debe listar boards del workspace', async () => {
      await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Board 1'),
      });
      await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Board 2'),
      });

      const response = await request(app)
        .get(`/api/workspaces/${testWorkspace.id}/boards`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/boards/:id', () => {
    it('debe obtener board por ID', async () => {
      const board = await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Test Board'),
      });

      const response = await request(app)
        .get(`/api/boards/${board.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(board.id);
      expect(response.body.title).toBe(board.title);
    });

    it('debe incluir listas y cards', async () => {
      const board = await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Board with Lists'),
      });

      const response = await request(app)
        .get(`/api/boards/${board.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('lists');
      expect(Array.isArray(response.body.lists)).toBe(true);
    });
  });

  describe('PATCH /api/boards/:id', () => {
    it('debe actualizar título del board', async () => {
      const board = await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Original Title'),
      });

      const newTitle = generateTestName('Updated Title');
      const response = await request(app)
        .patch(`/api/boards/${board.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ title: newTitle })
        .expect(200);

      expect(response.body.title).toBe(newTitle);
    });
  });

  describe('DELETE /api/boards/:id', () => {
    it('debe eliminar board', async () => {
      const board = await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Board to Delete'),
      });

      await request(app)
        .delete(`/api/boards/${board.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(204);

      await request(app)
        .get(`/api/boards/${board.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(404);
    });
  });

  describe('POST /api/boards/:id/lists', () => {
    it('debe crear lista en board', async () => {
      const board = await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Test Board'),
      });

      const response = await request(app)
        .post(`/api/boards/${board.id}/lists`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ title: 'To Do', position: 0 })
        .expect(201);

      expect(response.body.title).toBe('To Do');
      expect(response.body.boardId).toBe(board.id);
    });
  });

  describe('POST /api/lists/:listId/cards', () => {
    it('debe crear card en lista', async () => {
      const board = await createBoard(app, testUser.accessToken!, testWorkspace.id!, {
        title: generateTestName('Test Board'),
      });

      const listResponse = await request(app)
        .post(`/api/boards/${board.id}/lists`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ title: 'To Do', position: 0 })
        .expect(201);

      const response = await request(app)
        .post(`/api/lists/${listResponse.body.id}/cards`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ title: 'Test Card', position: 0 })
        .expect(201);

      expect(response.body.title).toBe('Test Card');
      expect(response.body.listId).toBe(listResponse.body.id);
    });
  });
});
