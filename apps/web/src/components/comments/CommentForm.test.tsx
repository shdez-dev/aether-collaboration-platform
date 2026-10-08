import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommentForm } from './CommentForm';

jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'me', name: 'Yo' } }) }));
jest.mock('@/hooks/useWorkspaceMembers', () => ({ useWorkspaceMembers: () => ({ members: [] }) }));

describe('CommentForm', () => {
  const candidates = [{ id: 'person-1', name: 'Ana Pérez', email: 'ana@example.com' }];

  it('permite mencionar a una persona del proyecto y envía su ID', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} mentionCandidates={candidates} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola ' } });
    fireEvent.click(screen.getByRole('button', { name: '@ Mencionar' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: /Ana Pérez/ }));
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.stringContaining('@[Ana Pérez]'), ['person-1']));
  });

  it('conserva el texto y muestra el error cuando no puede publicarse', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('No se pudo guardar'));
    render(<CommentForm onSubmit={onSubmit} mentionCandidates={candidates} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi comentario' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'No se pudo guardar');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Mi comentario');
  });
});
