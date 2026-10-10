import { pool } from '../../lib/db';
import { notificationRepository } from '../../repositories/NotificationRepository';
import { notificationService } from '../NotificationService';
import { calendarEventService } from '../CalendarEventService';

jest.mock('../../lib/db', () => ({ pool: { connect: jest.fn(), query: jest.fn() } }));
jest.mock('../../repositories/NotificationRepository', () => ({
  notificationRepository: { upsertActive: jest.fn() },
}));
jest.mock('../NotificationService', () => ({ notificationService: { createCalendarInvitationNotification: jest.fn() } }));

const client = { query: jest.fn(), release: jest.fn() };
const poolMock = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
  (poolMock.connect as jest.Mock).mockResolvedValue(client);
  (poolMock.query as jest.Mock).mockResolvedValue({ rows: [] });
  (notificationRepository.upsertActive as jest.Mock).mockResolvedValue(null);
  (notificationService.createCalendarInvitationNotification as jest.Mock).mockResolvedValue(null);
});

it('rejects a person outside Contacts before creating an event', async () => {
  client.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT u.id FROM users') ? [] : [] }));
  await expect(calendarEventService.create('creator', 'Creator', {
    title: 'Review', startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(),
    type: 'personal', inviteeIds: ['stranger'],
  })).rejects.toThrow('Solo puedes invitar');
  expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_events'), expect.anything());
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
});

it('creates a pending invitation without adding the contact as an attendee', async () => {
  const start = new Date();
  const end = new Date(start.getTime() + 3600000);
  client.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT u.id FROM users') ? [{ id: 'contact' }]
    : sql.includes('INSERT INTO calendar_events') ? [{ id: 'event', title: 'Review', description: null,
      start_time: start, end_time: end, all_day: false, color: '#7452A6', type: 'personal',
      workspace_id: null, team_id: null, created_by: 'creator', created_at: start, updated_at: start }] : [] }));
  await calendarEventService.create('creator', 'Creator', {
    title: 'Review', startTime: start.toISOString(), endTime: end.toISOString(),
    type: 'personal', inviteeIds: ['contact'],
  });
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_event_invitations'), ['event', 'contact', 'creator']);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_event_attendees'), ['event', 'creator']);
  expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_event_attendees'), ['event', 'contact']);
  expect(notificationService.createCalendarInvitationNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'contact' }));
});

it('accepts only the recipient’s pending invitation and then adds them to attendees', async () => {
  client.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('UPDATE calendar_event_invitations') ? [{ event_id: 'event' }] : [] }));
  await expect(calendarEventService.respondToInvitation('event', 'recipient', true)).resolves.toBe(true);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('AND user_id = $2 AND status = \'PENDING\''), ['event', 'recipient', 'ACCEPTED']);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_event_attendees'), ['event', 'recipient']);
});

it('does not add a rejected invitation to the calendar', async () => {
  client.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('UPDATE calendar_event_invitations') ? [{ event_id: 'event' }] : [] }));
  await expect(calendarEventService.respondToInvitation('event', 'recipient', false)).resolves.toBe(true);
  expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_event_attendees'), expect.anything());
});

it('cannot respond for another user or respond twice', async () => {
  client.query.mockResolvedValue({ rows: [] });
  await expect(calendarEventService.respondToInvitation('event', 'outsider', true)).resolves.toBe(false);
  expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO calendar_event_attendees'), expect.anything());
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
});

it('shows the creator who was invited and the response status when reading the event', async () => {
  const now = new Date();
  (poolMock.query as jest.Mock).mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT ce.*') ? [{
    id: 'event', title: 'Review', description: null, start_time: now, end_time: new Date(now.getTime() + 3600000),
    all_day: false, color: '#7452A6', type: 'personal', workspace_id: null, team_id: null,
    created_by: 'creator', created_at: now, updated_at: now,
  }] : sql.includes('FROM calendar_event_invitations i') ? [{
    id: 'contact', name: 'Contacto', avatar: null, status: 'PENDING',
  }] : [] }));
  const event = await calendarEventService.getById('event', 'creator');
  expect(event?.invitees).toEqual([{ id: 'contact', name: 'Contacto', avatar: null, status: 'PENDING' }]);
});
