import * as Y from 'yjs';
import { pool } from '../../lib/db';
import {
  documentService,
  DocumentRestoreConflictError,
  DocumentTextLimitError,
} from '../DocumentService';

jest.mock('../../lib/db');
jest.mock('../OrganizationStorageService', () => ({
  organizationStorageService: {
    lockForDocument: jest.fn().mockResolvedValue('org-1'),
    getUsage: jest.fn().mockResolvedValue({ usedBytes: 0n, limitBytes: null }),
    assertWithinLimit: jest.fn(),
  },
}));

function stateWithText(text: string): Uint8Array {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement('paragraph');
  const content = new Y.XmlText();
  content.insert(0, text);
  paragraph.insert(0, [content]);
  doc.getXmlFragment('prosemirror').insert(0, [paragraph]);
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

describe('límite de contenido de documentos', () => {
  it('cuenta los caracteres visibles, incluidos los espacios', () => {
    expect(documentService.getVisibleTextLength(stateWithText('Hola mundo'))).toBe(10);
  });

  it('rechaza guardar un documento nuevo de más de 100.000 caracteres', async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ id: 'doc-1', content: '', yjs_state: null, current_bytes: 0 }] }).mockResolvedValue({}),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(client);

    await expect(documentService.updateYjsState('doc-1', stateWithText('a'.repeat(100_001))))
      .rejects.toBeInstanceOf(DocumentTextLimitError);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE documents'), expect.anything());
  });
});

describe('guardado concurrente de documentos', () => {
  it('rechaza un autosave de una generación anterior a la restauración', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT id, content, yjs_state')) {
          return {
            rows: [{
              id: 'doc-1',
              content: 'Versión restaurada',
              yjs_state: stateWithText('Versión restaurada'),
              restore_generation: 1,
            }],
          };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(client);

    await expect(
      documentService.updateYjsState('doc-1', stateWithText('Autosave antiguo'), 0)
    ).rejects.toBeInstanceOf(DocumentRestoreConflictError);

    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE documents'), expect.anything());
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('fusiona cambios de dos clientes con el estado persistido', async () => {
    const base = stateWithText('Inicio');
    const first = new Y.Doc();
    const second = new Y.Doc();
    Y.applyUpdate(first, base);
    Y.applyUpdate(second, base);
    const firstText = (first.getXmlFragment('prosemirror').get(0) as Y.XmlElement).get(0) as Y.XmlText;
    const secondText = (second.getXmlFragment('prosemirror').get(0) as Y.XmlElement).get(0) as Y.XmlText;
    firstText.insert(0, 'A');
    secondText.insert(6, 'B');

    let persisted: Uint8Array = base;
    const client = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT id, content, yjs_state')) {
          return { rows: [{ id: 'doc-1', content: 'Inicio', yjs_state: persisted }] };
        }
        if (sql.includes('UPDATE documents')) persisted = params?.[0] as Uint8Array;
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(client);

    await documentService.updateYjsState('doc-1', Y.encodeStateAsUpdate(first));
    await documentService.updateYjsState('doc-1', Y.encodeStateAsUpdate(second));

    const merged = new Y.Doc();
    Y.applyUpdate(merged, persisted);
    const paragraph = merged.getXmlFragment('prosemirror').get(0) as Y.XmlElement;
    expect((paragraph.get(0) as Y.XmlText).toString()).toBe('AInicioB');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['doc-1']
    );
    first.destroy();
    second.destroy();
    merged.destroy();
  });
});
