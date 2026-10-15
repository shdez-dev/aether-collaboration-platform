import * as Y from 'yjs';
import { documentTemplateService } from '../DocumentTemplateService';

describe('quick capture document templates', () => {
  it('keeps a note body in the collaborative document state', () => {
    const state = documentTemplateService.createYjsStateFromTemplate('quick-note', { body: 'Primera línea\nSegunda línea' });
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);

    const content = doc.getXmlFragment('default').toString();
    expect(content).toContain('Primera línea');
    expect(content).toContain('Segunda línea');
    doc.destroy();
  });

  it('keeps a decision motive and next step', () => {
    const state = documentTemplateService.createYjsStateFromTemplate('decision-record', {
      body: 'Elegimos la propuesta A por su alcance.',
      nextStep: 'Preparar el tablero.',
    });
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);

    const content = doc.getXmlFragment('default').toString();
    expect(content).toContain('Elegimos la propuesta A por su alcance.');
    expect(content).toContain('Preparar el tablero.');
    doc.destroy();
  });
});
