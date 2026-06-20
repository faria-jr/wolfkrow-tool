# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security bugs seriously. Thank you for improving the security of Wolfkrow Tool.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

📧 **Email**: [email protected]

Please include:

1. Type of issue (e.g., buffer overflow, SQL injection, XSS, etc)
2. Full paths of source file(s) related to the issue
3. Location of affected source code (tag/branch/commit/direct URL)
4. Step-by-step reproduction instructions
5. Proof-of-concept or exploit code (if possible)
6. Impact of the issue

You should receive a response within 48 hours. If for some reason you do not, please follow up via email.

## Security Measures

Wolfkrow Tool implements several security measures:

- **Authentication**: bcrypt + TOTP + JWT in HttpOnly cookies
- **Authorization**: Permission guard for tool calls
- **Encryption**: OS keychain via keytar for secrets
- **Sandboxing**: Browser sandbox + Worker process isolation
- **CSP**: Content Security Policy headers
- **SQL injection prevention**: Drizzle ORM prepared statements
- **CSRF protection**: SameSite=Strict cookies
- **Rate limiting**: Login attempts, API calls
- **Audit log**: All sensitive operations logged

## Best Practices for Contributors

- **Never** commit secrets, API keys, or credentials
- **Never** disable TypeScript strict mode (`any`, `// @ts-ignore`)
- **Always** validate user input (Zod schemas)
- **Always** escape output (React does this by default)
- **Always** use prepared statements (Drizzle)
- **Always** check permissions before sensitive operations
- **Always** log sensitive operations (audit trail)

## Security Audit

Run `pnpm audit` to check for known vulnerabilities in dependencies.

## Responsible Disclosure

We follow a 90-day responsible disclosure policy:

1. **Day 0**: Vulnerability reported
2. **Day 1-7**: Acknowledgment + triage
3. **Day 7-30**: Fix development + testing
4. **Day 30-60**: Pre-release testing with reporter
5. **Day 60-90**: Public disclosure + release
6. **Day 90+**: Public CVE (if applicable)
