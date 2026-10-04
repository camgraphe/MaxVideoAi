WITH bounds AS (
  SELECT TIMESTAMPTZ '2026-09-01 00:00:00+00' AS window_start,
         TIMESTAMPTZ '2026-09-30 00:00:00+00' AS window_end,
         TIMESTAMPTZ '2026-09-30 00:00:00+00' AS as_of
), first_review AS (
  SELECT DISTINCT ON (e.user_id) e.user_id, e.created_at AS review_at
  FROM checkout_interaction_events e CROSS JOIN bounds b
  WHERE e.user_id <> ALL(:admin_ids)
    AND e.event_name = 'topup_review_opened'
    AND e.metadata->>'source' = 'workspace'
    AND e.metadata->>'measurement_version' = '1'
    AND e.created_at >= b.window_start
    AND e.created_at < LEAST(b.window_end, b.as_of)
  ORDER BY e.user_id, e.created_at, e.id
), cohort AS (
  SELECT f.*, LEAST(f.review_at + INTERVAL '7 days', b.as_of) AS observation_end,
         f.review_at + INTERVAL '7 days' <= b.as_of AS mature
  FROM first_review f CROSS JOIN bounds b
  WHERE NOT EXISTS (
    SELECT 1 FROM app_receipts r
    WHERE r.user_id = f.user_id AND r.type = 'topup'
      AND r.stripe_payment_intent_id IS NOT NULL AND r.created_at < f.review_at
  )
), stages AS (
  SELECT c.*, quote.quote_at, intent.intent_at, paid.paid_at, paid.stripe_checkout_session_id
  FROM cohort c
  LEFT JOIN LATERAL (
    SELECT MIN(e.created_at) AS quote_at
    FROM checkout_interaction_events e
    WHERE e.user_id = c.user_id AND e.event_name = 'topup_quote_displayed'
      AND e.metadata->>'source' = 'workspace' AND e.metadata->>'measurement_version' = '1'
      AND e.created_at >= c.review_at AND e.created_at < c.observation_end
  ) quote ON TRUE
  LEFT JOIN LATERAL (
    SELECT MIN(e.created_at) AS intent_at
    FROM checkout_interaction_events e
    WHERE e.user_id = c.user_id AND e.event_name = 'hosted_checkout_requested'
      AND e.metadata->>'source' = 'workspace'
      AND e.created_at >= quote.quote_at AND e.created_at < c.observation_end
  ) intent ON TRUE
  LEFT JOIN LATERAL (
    SELECT r.created_at AS paid_at, r.stripe_checkout_session_id
    FROM app_receipts r
    WHERE r.user_id = c.user_id AND r.type = 'topup' AND r.stripe_payment_intent_id IS NOT NULL
      AND r.created_at >= c.review_at AND r.created_at < c.observation_end
    ORDER BY r.created_at, r.id LIMIT 1
  ) paid ON TRUE
), classified AS (
  SELECT s.*, paid_at >= intent_at AS ordered_paid,
    EXISTS (
      SELECT 1 FROM checkout_interaction_events e
      WHERE e.user_id = s.user_id AND e.event_name = 'hosted_checkout_redirecting'
        AND e.metadata->>'source' = 'workspace'
        AND e.stripe_checkout_session_id = s.stripe_checkout_session_id
        AND e.created_at >= s.intent_at AND e.created_at <= s.paid_at
    ) AND paid_at >= intent_at AS matched_paid,
    EXISTS (
      SELECT 1 FROM checkout_interaction_events e
      WHERE e.user_id = s.user_id AND e.event_name = 'hosted_checkout_success_return'
        AND e.created_at >= s.intent_at AND e.created_at < s.observation_end
        AND EXISTS (
          SELECT 1 FROM checkout_interaction_events redirect
          WHERE redirect.user_id = s.user_id AND redirect.event_name = 'hosted_checkout_redirecting'
            AND redirect.metadata->>'source' = 'workspace'
            AND redirect.stripe_checkout_session_id = e.stripe_checkout_session_id
            AND redirect.created_at >= s.intent_at AND redirect.created_at <= e.created_at
        )
    ) AS success_return
  FROM stages s
)
SELECT COUNT(*) AS review_users,
       COUNT(*) FILTER (WHERE mature) AS mature_review_users,
       COUNT(*) FILTER (WHERE quote_at IS NOT NULL) AS quote_displayed_users,
       COUNT(*) FILTER (WHERE intent_at IS NOT NULL) AS ordered_checkout_users,
       COUNT(*) FILTER (WHERE ordered_paid) AS ordered_first_topup_users,
       COUNT(*) FILTER (WHERE matched_paid) AS session_matched_first_topup_users,
       COUNT(*) FILTER (WHERE success_return) AS success_return_users,
       COUNT(*) FILTER (WHERE mature AND intent_at IS NOT NULL) AS mature_ordered_checkout_users,
       COUNT(*) FILTER (WHERE mature AND ordered_paid) AS mature_ordered_first_topup_users,
       COUNT(*) FILTER (WHERE mature AND matched_paid) AS mature_session_matched_first_topup_users,
       COUNT(*) FILTER (WHERE NOT mature) AS pending_review_users,
       ROUND(100.0 * COUNT(*) FILTER (WHERE mature AND ordered_paid)
         / NULLIF(COUNT(*) FILTER (WHERE mature AND intent_at IS NOT NULL), 0), 1)
         AS mature_checkout_to_first_topup_pct
FROM classified
