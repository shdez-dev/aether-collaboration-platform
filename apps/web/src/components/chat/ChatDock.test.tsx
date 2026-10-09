import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatDock from './ChatDock';
import { apiService } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/services/socketService', () => ({ socketService: {
  on: jest.fn(), off: jest.fn(), onConnect: jest.fn(), offConnect: jest.fn(),
} }));

const other = { id: 'user-2', name: 'Jennifer Ruiz', avatar: null, position: 'Diseñadora' };

describe('panel global de mensajes', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    (apiService.get as jest.Mock).mockReset().mockImplementation(async (url: string) => {
      if (url === '/api/chat/contacts') return { success: true, data: { contacts: [] } };
      if (url === '/api/chat/conversations') return { success: true, data: { conversations: [] } };
      if (url === '/api/chat/requests') return { success: true, data: { requests: [] } };
      if (url === '/api/chat/eligibility/user-2') return { success: true, data: { canMessage: false, relationship: 'none' } };
      return { success: true, data: { messages: [] } };
    });
    (apiService.post as jest.Mock).mockReset().mockResolvedValue({ success: true, data: { id: 'request-1' } });
  });

  it('abre desde cualquier página e incluye chats, contactos y solicitudes', async () => {
    render(<ChatDock userId="user-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir mensajes' }));
    expect(screen.getByRole('dialog', { name: 'Mensajes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chats' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contactos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solicitudes' })).toBeTruthy();
  });

  it('pide aceptación antes de escribir a una persona externa', async () => {
    render(<ChatDock userId="user-1" />);
    window.dispatchEvent(new CustomEvent('aether:open-chat', { detail: { ...other, userId: other.id } }));
    expect(await screen.findByText(/primero debe aceptar tu solicitud/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/api/chat/requests', { userId: other.id }, true));
    expect(await screen.findByText('Solicitud enviada')).toBeTruthy();
  });

  it('muestra la retención de 30 días antes de redactar un mensaje', async () => {
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/chat/conversations') return { success: true, data: { conversations: [] } };
      if (url === '/api/chat/requests') return { success: true, data: { requests: [] } };
      if (url === '/api/chat/contacts') return { success: true, data: { contacts: [other] } };
      if (url === '/api/chat/eligibility/user-2') return { success: true, data: { canMessage: true, relationship: 'connected' } };
      return { success: true, data: { messages: [] } };
    });
    (apiService.post as jest.Mock).mockResolvedValue({ success: true, data: { conversationId: 'conversation-1' } });
    render(<ChatDock userId="user-1" />);
    window.dispatchEvent(new CustomEvent('aether:open-chat', { detail: { ...other, userId: other.id } }));
    expect(await screen.findByText('Los mensajes se eliminan automáticamente después de 30 días.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Escribir mensaje' })).toBeTruthy();
  });
});
