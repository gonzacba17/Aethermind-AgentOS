-- Mark all existing users as email-verified to avoid breaking current accounts
UPDATE users SET email_verified = true WHERE email_verified = false OR email_verified IS NULL;
