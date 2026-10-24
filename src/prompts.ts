// One-click workflow prompts for the trust/memory services, in the same style as
// the data-service prompts in server.ts: each tells the assistant which real
// tools to call and how to read the results, never to invent a value. Nothing
// here signs anything; wallet signatures always come from the user's own wallet.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const text = (t: string) => ({ role: "user" as const, content: { type: "text" as const, text: t } });

export function registerSuitePrompts(server: McpServer) {
  server.registerPrompt(
    "fact_check",
    {
      title: "Fact-check before acting",
      description: "Split an answer into claims and verify each against your source text (or live web evidence) with Wicked Sanity before you rely on it.",
      argsSchema: {
        output: z.string().describe("The text to check - an AI answer, summary or report."),
        source: z.string().optional().describe("The source text the output must be faithful to. Omit to check against live web evidence instead."),
      },
    },
    ({ output, source }) => ({
      description: "Fact-check workflow",
      messages: [
        text(
          `Verify the following output before I act on it. Don't judge it yourself - use the tools.\n\n` +
            `1. Split it into individual factual claims (one sentence each).\n` +
            `2. Call \`sanity_check_batch\` once with all claims, ` +
            (source
              ? `mode="grounded" and context set to the source text below.\n`
              : `mode="open" (no source supplied, so check against live web evidence).\n`) +
            `3. Report every claim with its exact verdict (supported / contradicted / unsupported / insufficient_evidence) ` +
            `and the evidence returned. Treat unsupported and insufficient_evidence as UNVERIFIED, and contradicted as wrong.\n` +
            `4. If the response has http_status 402, 429 or another error, say so plainly - do not guess verdicts.\n\n` +
            `OUTPUT TO CHECK:\n${output}\n` +
            (source ? `\nSOURCE:\n${source}\n` : "")
        ),
      ],
    })
  );

  server.registerPrompt(
    "verify_agent",
    {
      title: "Check an agent's trust",
      description: "Combine Wicked Identity (is this wallet a verified autonomous agent?) and Wicked Reputation (what does it have at stake?) before you transact with it.",
      argsSchema: { wallet: z.string().describe("The agent's 0x wallet address.") },
    },
    ({ wallet }) => ({
      description: "Agent trust check",
      messages: [
        text(
          `Before I deal with the agent at ${wallet}, check its real trust signals - don't assume anything:\n\n` +
            `1. Call \`identity_status\` with wallet="${wallet}": does it hold a valid, unexpired Know-Your-Agent assertion? Report the exact fields.\n` +
            `2. Call \`reputation_status\` with wallet="${wallet}": tier, active stake, reputation score, slash count. ` +
            `An http_status 404 means the wallet never registered - report that as "unranked", not an error.\n` +
            `3. Call \`reputation_statement\` only if it has stake or slashes and I need the event history.\n\n` +
            `Summarize plainly: verified or not, stake and tier, any slashes, and what is unknown. State that this is ` +
            `a set of signals, not a guarantee. If a call returns a 402, show the payment instructions rather than guessing.`
        ),
      ],
    })
  );

  server.registerPrompt(
    "find_reliable_tool",
    {
      title: "Find a reliable tool",
      description: "Search the Wicked Registry for x402/MCP tools by real uptime, latency and schema-conformance scores before you pay for one.",
      argsSchema: {
        need: z.string().describe('What you need the tool for, e.g. "token price data".'),
        category: z.string().optional().describe('Registry category filter, e.g. "data" or "crypto".'),
        min_score: z.string().optional().describe("Minimum composite score 0-100."),
      },
    },
    ({ need, category, min_score }) => ({
      description: "Reliable tool discovery",
      messages: [
        text(
          `I need a tool for: ${need}. Find options with real reliability data - never recommend from memory.\n\n` +
            `1. Call \`registry_featured_tools\` (free) for the top scored tools.\n` +
            `2. Call \`registry_search_tools\`` +
            (category ? ` with category="${category}"` : "") +
            (min_score ? ` and min_score=${min_score}` : "") +
            `. If it returns a 402, show me the payment instructions and continue with the free results.\n` +
            `3. For the best 1-3 candidates call \`registry_tool_detail\` (or \`registry_tool_badge\` for a free score) and report ` +
            `uptime, p95 latency and schema conformance exactly as returned. Tools with no check history have no score - say so.\n\n` +
            `Recommend one, with the numbers that justify it.`
        ),
      ],
    })
  );

  server.registerPrompt(
    "agent_memory_guide",
    {
      title: "Use Wicked Memory",
      description: "Walk through storing and searching persistent, wallet-scoped memory - including the two-step signing flow.",
      argsSchema: {
        wallet: z.string().describe("Your agent's 0x wallet address (memories are scoped to it)."),
        task: z.string().describe('What to do, e.g. "remember that I prefer concise answers" or "find what I stored about the Q3 launch".'),
      },
    },
    ({ wallet, task }) => ({
      description: "Wicked Memory walkthrough",
      messages: [
        text(
          `Use Wicked Memory for wallet ${wallet} to: ${task}\n\n` +
            `Every memory call needs a fresh wallet signature, and this server never signs or holds a key:\n` +
            `1. Call \`memory_prepare\` with the operation ("store" or "search") and the exact params you will use. It returns \`message_to_sign\`, \`timestamp\` and \`nonce\`.\n` +
            `2. Ask ME to sign \`message_to_sign\` with the wallet (EIP-191 personal_sign) and give you the signature. Never invent one.\n` +
            `3. Call the matching tool (\`memory_store\` / \`memory_search\`) with the SAME params plus timestamp, nonce and signature.\n` +
            `4. A nonce is single-use and the timestamp must be within 5 minutes - prepare again for every call. ` +
            `\`memory_search\` is metered: if it returns http_status 402, show me the payment instructions; the same signed request can be retried with a payment_signature.\n\n` +
            `Report exactly what the tools returned.`
        ),
      ],
    })
  );

  server.registerPrompt(
    "counterparty_check",
    {
      title: "Check a counterparty before you pay",
      description: "Screen a wallet or contract before sending funds: OFAC sanctions, malicious-address flags, and (if it is an agent) its identity and stake.",
      argsSchema: { address: z.string().describe("The 0x wallet or contract address you are about to transact with.") },
    },
    ({ address }) => ({
      description: "Counterparty screening",
      messages: [
        text(
          `Before I send anything to ${address}, screen it with real data - never guess:

` +
            `1. Call \`wallet_sanctions_check\` (free) with the address. Report whether it is on the OFAC SDN list and the sanctioned entity if so.
` +
            `2. Call \`wallet_check\` for the broader pre-transaction check (malicious-address flags and on-chain signals). If it returns http_status 402, show me the price from payment_required and continue with what is free.
` +
            `3. If this address is an agent I might deal with repeatedly, also call \`identity_status\` and \`reputation_status\` for it (a 404 from reputation means never registered, not an error).

` +
            `Summarize: sanctioned or not, any flags, and what is unknown. These are signals, not a guarantee.`
        ),
      ],
    })
  );

  server.registerPrompt(
    "insider_watch",
    {
      title: "Insider and filings watch",
      description: "For a stock ticker, combine recent insider trading, an insider summary and classified 8-K events from SEC filings.",
      argsSchema: {
        ticker: z.string().describe('US stock ticker, e.g. "NVDA".'),
        days: z.string().optional().describe("Lookback window in days (default 30)."),
      },
    },
    ({ ticker, days }) => ({
      description: "Insider and filings watch",
      messages: [
        text(
          `Build an insider and filings view of ${ticker} over the last ${days || "30"} days using real data only:

` +
            `1. \`filings_insider_summary\` for the ticker: open-market buy and sell counts and dollar totals.
` +
            `2. \`filings_insider_trades\` for the individual Form 4 trades (insider, role, code, size). Report exact values.
` +
            `3. \`filings_8k_events\` for material events (earnings, executive changes, agreements).
` +
            `4. Optionally \`earnings_calendar\` for the next report date.

` +
            `If any call returns http_status 402, show the price from payment_required rather than guessing. Then summarize what the filings actually show; do not speculate beyond them.`
        ),
      ],
    })
  );

  server.registerPrompt(
    "trade_idea_check",
    {
      title: "Check a trade idea",
      description: "Pressure-test a trade on one asset with the verdict engine, volatility, positioning and fresh news, without inventing numbers.",
      argsSchema: {
        symbol: z.string().describe("Asset symbol, e.g. BTC, ETH, SOL, NVDA."),
        timeframe: z.string().optional().describe("Timeframe such as 1h or 1D (default 1h)."),
      },
    },
    ({ symbol, timeframe }) => ({
      description: "Trade idea check",
      messages: [
        text(
          `Pressure-test a trade on ${symbol} (${timeframe || "1h"}) from real tool output only:

` +
            `1. \`verdict\` for the bias, confidence, thesis, entry, invalidation and targets.
` +
            `2. \`atr\` for volatility and regime (size the stop from it).
` +
            `3. For crypto: \`funding_oi\` and \`long_short_ratio\` for crowding; \`liquidity_levels\` for nearby pools.
` +
            `4. \`crypto_news\` for fresh headlines that could invalidate the idea.

` +
            `Quote exact values. If a call returns 402, show the price instead of guessing. End with a plain verdict and what would invalidate it. This is analysis from tools, not financial advice.`
        ),
      ],
    })
  );
}

