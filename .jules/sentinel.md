## 2024-05-23 - Hardcoded Admin Credentials in Scripts
**Vulnerability:** Found hardcoded admin passwords ('Admin@2025!', 'Backup@2025!') in `scripts/create-admin.ts`.
**Learning:** Scripts used for operational tasks (like creating admin users) are often overlooked during security reviews but can contain critical secrets.
**Prevention:** Always use environment variables for sensitive data, even in helper scripts. Scan scripts directory for high-entropy strings or variable names like "password", "secret", "key".
