-- Verify the test QA account email so it can log in
UPDATE users SET email_verified = NOW() WHERE email = 'test.famille.qa@mailinator.com';
