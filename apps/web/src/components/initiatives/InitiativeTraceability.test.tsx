import { fireEvent, render, screen, within } from '@testing-library/react';
import { InitiativeTraceability } from './InitiativeTraceability';

it('ordena los hechos y permite revisar el detalle de una edición institucional', () => {
  render(
    <InitiativeTraceability
      initiativeId="initiative-1"
      currentStage="TRIAGE"
      receivedAt="2026-10-10T08:00:00.000Z"
      history={[
        {
          id: 'stage-1',
          toStage: 'SUBMITTED',
          actorName: 'Ana',
          createdAt: '2026-10-10T08:00:00.000Z',
          triageAssessment: [
            { criterion: 'Pertinencia institucional', status: 'PASS', note: 'Se ajusta al programa.' },
          ],
        },
      ]}
      assignmentHistory={[
        {
          id: 'role-1',
          action: 'ASSIGNED',
          role: 'MENTOR',
          subjectName: 'Luis',
          actorName: 'Ana',
          createdAt: '2026-10-10T09:00:00.000Z',
        },
      ]}
      contentHistory={[
        {
          id: 'edit-1',
          actorName: 'Luis',
          createdAt: '2026-10-10T10:00:00.000Z',
          changes: { expectedOutcome: { from: 'Propuesta inicial', to: 'Propuesta validada' } },
        },
      ]}
    />
  );

  const list = screen.getByRole('list');
  const items = within(list).getAllByRole('listitem');
  expect(items[0].textContent).toContain('Expediente actualizado');
  expect(items[1].textContent).toContain('Asignación de mentoría');
  expect(items[2].textContent).toContain('Iniciativa recibida');
  expect(items[2].textContent).toContain('Pertinencia institucional');

  fireEvent.click(screen.getByText('Ver valores anteriores y nuevos'));
  expect(screen.getByText('Propuesta inicial')).toBeTruthy();
  expect(screen.getByText('Propuesta validada')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Responsables' }));
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByText('Expediente actualizado')).toBeNull();
});
