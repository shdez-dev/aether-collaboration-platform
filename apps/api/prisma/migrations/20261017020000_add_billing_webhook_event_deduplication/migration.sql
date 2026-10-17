CREATE TABLE billing_webhook_events (
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  received_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT billing_webhook_events_pkey PRIMARY KEY (provider, event_id)
);

CREATE INDEX billing_webhook_events_received_at_idx
  ON billing_webhook_events(received_at);
