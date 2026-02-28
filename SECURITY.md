# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a Vulnerability

If you discover a security issue, please report it responsibly.

**Email:** engineering@iteachyouai.com

**Please include:**
- Description of the issue
- Steps to reproduce
- Impact assessment

**Response timeline:**
- Acknowledgment within 72 hours
- Fix target within 30 days

## Scope

This package classifies prompt complexity and returns advisory output (tier, effort level, model suggestion). It does not execute prompts, make API calls on behalf of users, or store any data.

Classification output is advisory only — it suggests settings but does not enforce them. The consuming application is responsible for how it uses the classification result.
