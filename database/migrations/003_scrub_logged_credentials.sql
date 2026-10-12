-- The old activity logger stored raw request bodies, including passwords sent
-- to /api/auth/login and the admin password endpoints. Remove them.

-- Auth requests: drop the body entirely.
UPDATE activity_logs
SET action_details = jsonb_set(action_details, '{body}', 'null'::jsonb)
WHERE action_type LIKE '% /api/auth/%'
   OR action_type LIKE '% /login'
   OR action_type LIKE '% /reset-password'
   OR action_type LIKE '% /forgot-password';

-- Everything else: remove credential fields from the body.
UPDATE activity_logs
SET action_details = jsonb_set(
  action_details,
  '{body}',
  (action_details -> 'body')
    - ARRAY['password', 'new_password', 'confirm_password', 'confirmPassword', 'confirm_new_password', 'token']
)
WHERE jsonb_typeof(action_details -> 'body') = 'object'
  AND (action_details -> 'body') ?| ARRAY['password', 'new_password', 'confirm_password', 'confirmPassword', 'confirm_new_password', 'token'];
