const mockIo = jest.fn();
jest.mock('socket.io-client', () => ({ io: (...args: unknown[]) => mockIo(...args) }));

import SocketService from './socketService';

function makeSocket() {
  const handlers = new Map<string, (...args: any[]) => void>();
  const socket = {
    connected: false,
    auth: {},
    on: jest.fn((event: string, callback: (...args: any[]) => void) => { handlers.set(event, callback); }),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  return { socket, handlers };
}

describe('SocketService scoped room subscriptions', () => {
  beforeEach(() => mockIo.mockReset());

  it('keeps shared workspace rooms until every owner leaves and restores rooms after reconnect', () => {
    const service = new SocketService();
    const { socket, handlers } = makeSocket();
    mockIo.mockReturnValue(socket);
    service.connect('access-token');
    socket.connected = true;
    handlers.get('connect')?.();

    service.joinWorkspace('workspace-1', 'layout');
    service.joinWorkspace('workspace-1', 'documents');
    service.joinProject('project-1', 'project-page');
    service.joinOrganization('organization-1', 'organization-page');
    service.joinBoard('board-1');

    expect(socket.emit).toHaveBeenCalledTimes(4);
    expect(socket.emit).toHaveBeenCalledWith('join:workspace', { workspaceId: 'workspace-1' });
    expect(socket.emit).toHaveBeenCalledWith('join:project', { projectId: 'project-1' });
    expect(socket.emit).toHaveBeenCalledWith('join:organization', { organizationId: 'organization-1' });
    expect(socket.emit).toHaveBeenCalledWith('join:board', { boardId: 'board-1' });

    service.leaveWorkspace('workspace-1', 'layout');
    expect(socket.emit).not.toHaveBeenCalledWith('leave:workspace', { workspaceId: 'workspace-1' });
    service.leaveWorkspace('workspace-1', 'documents');
    expect(socket.emit).toHaveBeenCalledWith('leave:workspace', { workspaceId: 'workspace-1' });

    socket.emit.mockClear();
    socket.connected = false;
    handlers.get('disconnect')?.('transport close');
    socket.connected = true;
    handlers.get('connect')?.();

    expect(socket.emit).toHaveBeenCalledTimes(3);
    expect(socket.emit).toHaveBeenCalledWith('join:project', { projectId: 'project-1' });
    expect(socket.emit).toHaveBeenCalledWith('join:organization', { organizationId: 'organization-1' });
    expect(socket.emit).toHaveBeenCalledWith('join:board', { boardId: 'board-1' });
  });
});
