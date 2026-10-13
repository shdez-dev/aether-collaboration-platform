-- Existing institutions created with an administrator's creation grant started
-- on Free before the matching institutional access was provisioned at creation.
-- Preserve any active paid plan while upgrading organizations still on Free.
INSERT INTO subscriptions
  (id, organization_id, plan_code, status, provider, provider_subscription_id,
   current_period_end, cancel_at_period_end, created_at, updated_at)
SELECT
  uuid_generate_v4(), o.id, 'INSTITUTIONAL', 'ACTIVE'::"SubscriptionStatus",
  'platform-admin', 'platform-admin:' || o.id::text,
  NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM organizations o
JOIN user_organization_creation_grants g
  ON g.user_id = o.owner_user_id AND g.organization_type = o.type
WHERE o.type = 'INSTITUTION'::"OrganizationType"
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.organization_id = o.id
      AND s.plan_code <> 'FREE'
      AND s.status IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
      AND (s.current_period_end IS NULL OR s.current_period_end > CURRENT_TIMESTAMP)
  )
ON CONFLICT (provider_subscription_id) DO UPDATE
  SET plan_code = EXCLUDED.plan_code,
      status = 'ACTIVE',
      current_period_end = NULL,
      cancel_at_period_end = FALSE,
      updated_at = CURRENT_TIMESTAMP;
