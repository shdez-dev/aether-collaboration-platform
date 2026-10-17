jest.unmock('./Yjsgateway');
jest.mock('../services/DocumentService', () => ({
  documentService: {
    checkDocumentAccess: jest.fn(),
    getEffectiveUserPermission: jest.fn(),
    getVisibleTextLength: jest.fn(),
    getDocumentAccessExpiresAt: jest.fn(),
  },
  DOCUMENT_TEXT_LIMIT: 100_000,
  DocumentRestoreConflictError: class DocumentRestoreConflictError extends Error {},
}));
jest.mock('../services/OrganizationStorageService', () => ({
  OrganizationStorageLimitError: class OrganizationStorageLimitError extends Error {},
}));

const { YjsGateway } = require('./Yjsgateway') as typeof import('./Yjsgateway');
const { documentService } = require('../services/DocumentService') as typeof import('../services/DocumentService');

type EventHandler = (data?: any) => unknown;

function createSocket() {
  const handlers = new Map<string, EventHandler>();
  const rooms = new Set<string>();
  const roomEmitter = { emit: jest.fn() };
  const socket = {
    id: 'socket-1',
    userId: 'user-1',
    userName: 'Test User',
    connected: true,
    rooms,
    on: jest.fn((event: string, handler: EventHandler) => handlers.set(event, handler)),
    emit: jest.fn(),
    join: jest.fn(async (room: string) => { rooms.add(room); }),
    leave: jest.fn(async (room: string) => { rooms.delete(room); }),
    to: jest.fn(() => roomEmitter),
  };

  return { socket, handlers, roomEmitter };
}

function createGateway() {
  let onConnection: ((socket: any) => void) | undefined;
  const sockets = new Map<string, any>();
  const io = {
    on: jest.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') onConnection = handler;
    }),
    sockets: { sockets, adapter: { rooms: new Map<string, Set<string>>() } },
  };
  const gateway = new YjsGateway(io as any);
  const socketFixture = createSocket();
  sockets.set(socketFixture.socket.id, socketFixture.socket);
  onConnection?.(socketFixture.socket);

  return { gateway, ...socketFixture, sockets };
}

describe('YjsGateway WebSocket security limits and access revalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (documentService.checkDocumentAccess as jest.Mock).mockResolvedValue(true);
    (documentService.getEffectiveUserPermission as jest.Mock).mockResolvedValue('EDIT');
    (documentService.getVisibleTextLength as jest.Mock).mockReturnValue(0);
    (documentService.getDocumentAccessExpiresAt as jest.Mock).mockResolvedValue(null);
  });

  it('rejects malformed updates before performing document access or persistence work', async () => {
    const { gateway, socket, handlers } = createGateway();
    const onUpdate = handlers.get('document:yjs:update');
    await onUpdate?.({
      documentId: 'document-1',
      update: [256],
      restoreGeneration: 0,
    });
    await onUpdate?.({
      documentId: 'document-1',
      update: new Array(1024 * 1024 + 1).fill(0),
      restoreGeneration: 0,
    });

    expect(socket.emit).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenNthCalledWith(1, 'error', { message: 'Invalid document update' });
    expect(socket.emit).toHaveBeenNthCalledWith(2, 'error', { message: 'Invalid document update' });
    expect(documentService.checkDocumentAccess).not.toHaveBeenCalled();
    expect((gateway as any).docs.size).toBe(0);
  });

  it('blocks a socket after 300 updates or five MiB within its rolling window', () => {
    const { gateway } = createGateway();
    const consume = (gateway as any).consumeYjsUpdateBudget.bind(gateway);

    for (let index = 0; index < 300; index += 1) {
      expect(consume('socket-1', 1)).toBeNull();
    }
    expect(consume('socket-1', 1)).toBeGreaterThan(0);

    const secondGateway = createGateway().gateway;
    const consumeBytes = (secondGateway as any).consumeYjsUpdateBudget.bind(secondGateway);
    for (let index = 0; index < 5; index += 1) {
      expect(consumeBytes('socket-1', 1024 * 1024)).toBeNull();
    }
    expect(consumeBytes('socket-1', 1)).toBeGreaterThan(0);
  });

  it('removes a live document subscription when the user no longer has access', async () => {
    const { gateway, socket } = createGateway();
    const activeDocuments = (gateway as any).socketToDocuments as Map<string, Set<string>>;
    activeDocuments.set(socket.id, new Set(['document-1']));
    socket.rooms.add('document:document-1');
    (documentService.checkDocumentAccess as jest.Mock).mockResolvedValue(false);
    (gateway as any).saveAndCleanup = jest.fn().mockResolvedValue(undefined);

    await gateway.revalidateUserDocuments('user-1');

    expect(socket.emit).toHaveBeenCalledWith('document:access:revoked', { documentId: 'document-1' });
    expect(socket.leave).toHaveBeenCalledWith('document:document-1');
    expect(activeDocuments.has(socket.id)).toBe(false);
  });
});
