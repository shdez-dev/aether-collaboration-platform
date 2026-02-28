import request from 'supertest';
import { Express } from 'express';

/**
 * Helpers para tests de integración de API
 */

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TestWorkspace {
  id?: string;
  name: string;
  ownerId?: string;
}

export interface TestBoard {
  id?: string;
  title: string;
  workspaceId?: string;
}

/**
 * Registra un usuario de prueba
 */
export async function registerUser(app: Express, userData: TestUser): Promise<TestUser> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: userData.name,
      email: userData.email,
      password: userData.password,
    })
    .expect(201);

  return {
    ...userData,
    id: response.body.user.id,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}

/**
 * Hace login de un usuario
 */
export async function loginUser(app: Express, email: string, password: string): Promise<TestUser> {
  const response = await request(app).post('/api/auth/login').send({ email, password }).expect(200);

  return {
    email,
    password,
    name: response.body.user.name,
    id: response.body.user.id,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}

/**
 * Crea un workspace de prueba
 */
export async function createWorkspace(
  app: Express,
  token: string,
  workspaceData: TestWorkspace
): Promise<TestWorkspace> {
  const response = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send(workspaceData)
    .expect(201);

  return {
    ...workspaceData,
    id: response.body.id,
    ownerId: response.body.ownerId,
  };
}

/**
 * Crea un board de prueba
 */
export async function createBoard(
  app: Express,
  token: string,
  workspaceId: string,
  boardData: TestBoard
): Promise<TestBoard> {
  const response = await request(app)
    .post(`/api/workspaces/${workspaceId}/boards`)
    .set('Authorization', `Bearer ${token}`)
    .send(boardData)
    .expect(201);

  return {
    ...boardData,
    id: response.body.id,
    workspaceId: response.body.workspaceId,
  };
}

/**
 * Genera un email único para tests
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Genera un nombre único para tests
 */
export function generateTestName(prefix: string): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}`;
}

/**
 * Limpia la base de datos (usar con cuidado)
 */
export async function cleanDatabase() {
  // Implementar según tu estrategia de limpieza
  // Puede ejecutar DELETE en tablas específicas o usar truncate
}
