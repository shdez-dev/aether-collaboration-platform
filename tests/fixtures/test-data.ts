/**
 * Datos de prueba para tests E2E
 */

export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    name: 'Admin User',
  },
  user1: {
    email: 'user1@test.com',
    password: 'TestPassword123!',
    name: 'Test User 1',
  },
  user2: {
    email: 'user2@test.com',
    password: 'TestPassword123!',
    name: 'Test User 2',
  },
} as const;

export const TEST_WORKSPACES = {
  workspace1: {
    name: 'Test Workspace 1',
    description: 'Workspace for testing purposes',
  },
  workspace2: {
    name: 'Test Workspace 2',
    description: 'Another test workspace',
  },
} as const;

export const TEST_BOARDS = {
  board1: {
    title: 'Test Board 1',
    description: 'Board for testing',
  },
  board2: {
    title: 'Test Board 2',
    description: 'Another test board',
  },
} as const;

export const TEST_CARDS = {
  card1: {
    title: 'Test Card 1',
    description: 'This is a test card',
  },
  card2: {
    title: 'Test Card 2',
    description: 'Another test card',
  },
} as const;

export const TEST_LISTS = {
  list1: {
    title: 'To Do',
    position: 0,
  },
  list2: {
    title: 'In Progress',
    position: 1,
  },
  list3: {
    title: 'Done',
    position: 2,
  },
} as const;
