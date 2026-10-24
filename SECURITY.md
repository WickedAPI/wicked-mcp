# Security policy

## Reporting a vulnerability
Please report suspected vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/WickedAPI/wicked-mcp/security/advisories/new)
rather than a public issue. Include the affected version, what you did and what you saw.
We aim to acknowledge reports within 3 business days.

## Scope and design notes
- This server never holds or asks for a private key. Wallet-signed tools (Identity, Memory,
  Registry registration, Reputation) return the exact message to sign; you sign it yourself.
- `WICKEDAPI_PAYER_PRIVATE_KEY` is only read when you run the server locally and opt in to auto-pay.
- The public remote at https://mcp.wickedapi.com/mcp is stateless and records only per-tool call
  counts (no arguments, no results, no IP addresses).
