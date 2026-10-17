import { createHmac } from 'crypto';
import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { BillingController } from '../BillingController';

jest.mock('../../lib/db', () => ({ pool: { connect: jest.fn() } }));

const connect = pool.connect as jest.Mock;
const controller = new BillingController();
const webhookSecret = 'billing-webhook-test-secret';

const billingEvent = {
  id: 'event-123',
  organizationId: 'e9d7d4a9-c46a-4a13-b5c7-44f62cb72153',
  planCode: 'TEAMS',
  status: 'ACTIVE',
  providerCustomerId: 'customer-123',
  providerSubscriptionId: 'subscription-123',
  periodEnd: '2026-11-17T12:00:00.000Z',
};

function signedRequest(payload: unknown, rawBody?: Buffer) {
  const body = rawBody ?? Buffer.from(JSON.stringify(payload, null, 2));
  const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
  return {
    body,
    headers: { 'x-billing-signature': signature },
  } as unknown as Request;
}

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('BillingController.webhook idempotency', () => {
  const originalWebhookSecret = process.env.BILLING_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.BILLING_WEBHOOK_SECRET = webhookSecret;
    connect.mockReset();
  });

  afterAll(() => {
    if (originalWebhookSecret === undefined) delete process.env.BILLING_WEBHOOK_SECRET;
    else process.env.BILLING_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it('records and applies a new event in one transaction using the raw signed body', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ event_id: billingEvent.id }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const release = jest.fn();
    connect.mockResolvedValue({ query, release });
    const res = response();

    await controller.webhook(signedRequest(billingEvent), res);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO billing_webhook_events'),
      expect.stringContaining('INSERT INTO subscriptions'),
      'COMMIT',
    ]);
    expect(query.mock.calls[1][1]).toEqual([expect.any(String), billingEvent.id]);
    expect(query.mock.calls[2][1]).toEqual([
      billingEvent.organizationId,
      billingEvent.planCode,
      billingEvent.status,
      expect.any(String),
      billingEvent.providerCustomerId,
      billingEvent.providerSubscriptionId,
      billingEvent.periodEnd,
    ]);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { duplicate: false } });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a duplicate event without applying the subscription update again', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const release = jest.fn();
    connect.mockResolvedValue({ query, release });
    const res = response();

    await controller.webhook(signedRequest(billingEvent), res);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO billing_webhook_events'),
      'COMMIT',
    ]);
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO subscriptions'), expect.anything());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { duplicate: true } });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back the event receipt when applying the subscription fails', async () => {
    const failure = new Error('subscription write failed');
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ event_id: billingEvent.id }], rowCount: 1 })
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const release = jest.fn();
    connect.mockResolvedValue({ query, release });

    await expect(controller.webhook(signedRequest(billingEvent), response())).rejects.toThrow(failure);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO billing_webhook_events'),
      expect.stringContaining('INSERT INTO subscriptions'),
      'ROLLBACK',
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rejects events without a subscription ID before opening a transaction', async () => {
    const { providerSubscriptionId: _providerSubscriptionId, ...eventWithoutSubscriptionId } = billingEvent;
    const res = response();

    await controller.webhook(signedRequest(eventWithoutSubscriptionId), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(connect).not.toHaveBeenCalled();
  });
});
