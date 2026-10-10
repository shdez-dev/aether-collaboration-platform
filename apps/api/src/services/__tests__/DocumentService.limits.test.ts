import * as Y from 'yjs';
import { pool } from '../../lib/db';
import { documentService, DocumentTextLimitError } from '../DocumentService';

jest.mock('../../lib/db');

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
