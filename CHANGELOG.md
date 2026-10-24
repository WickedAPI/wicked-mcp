# Changelog

## 0.7.2
- Every tool now carries a "Use when / Not for" line, a behavior line (read-only vs writes, free vs priced)
  and MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `title`).
- Generated tools take their free/priced flag and parameter docs from each service's `/v1/status` catalog.
- Picks up `verdict` and `wallet_portfolio` from the Trading Data API.

## 0.7.1
- Unpaid calls to priced data tools return the decoded x402 price (`payment_required`, `how_to_pay`) instead of an empty error.

## 0.7.0
- Every public endpoint of every Wicked service is a tool: Reputation (leaderboard, history, ERC-8004, signed stake flow),
  Registry key management, Sanity get-check.

## 0.6.x
- Filings and Wallet services, Identity sandbox tools, Registry self-serve onboarding, registry namespace `io.github.WickedAPI/wicked-mcp`.
