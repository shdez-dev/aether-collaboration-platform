import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DocumentReferencePicker } from './DocumentReferencePicker';
import { apiService } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

it('adjunta únicamente el fragmento seleccionado de un documento accesible', async () => {
  (apiService.get as jest.Mock).mockImplementation((path: string) => Promise.resolve(path.includes('document-candidates')
    ? { success: true, data: { documents: [{ id: 'doc-1', title: 'Plan' }] } }
    : { success: true, data: { document: { id: 'doc-1', title: 'Plan', content: 'Un texto importante' } } }));
  const onSelect = jest.fn();
  render(<DocumentReferencePicker cardId="card-1" onSelect={onSelect} onClose={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: /Plan/ }));
  const preview = await screen.findByText('Un texto importante');
  const range = document.createRange();
  range.setStart(preview.firstChild!, 3);
  range.setEnd(preview.firstChild!, 8);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent.mouseUp(preview);
  fireEvent.click(screen.getByRole('button', { name: 'Adjuntar fragmento' }));

  await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ documentId: 'doc-1', title: 'Plan', quote: 'texto', from: 3, to: 8 }));
});

it('muestra el error de carga sin confundirlo con una lista vacía y permite reintentar', async () => {
  (apiService.get as jest.Mock)
    .mockResolvedValueOnce({ success: false, error: { message: 'Ruta no disponible' } })
    .mockResolvedValueOnce({ success: true, data: { documents: [{ id: 'doc-1', title: 'Plan' }] } });
  render(<DocumentReferencePicker cardId="card-1" onSelect={jest.fn()} onClose={jest.fn()} />);

  expect((await screen.findByRole('alert')).textContent).toContain('Ruta no disponible');
  expect(screen.queryByText('No hay documentos disponibles en este proyecto.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('button', { name: /Plan/ })).toBeTruthy();
});
