// Tool metadata that makes the 100+ tools easy for an agent to choose between:
// a "when to use / when not to" line for each tool, an accurate behavior line
// (read-only vs writes, free vs priced), and MCP tool annotations. Directory
// scorers (Glama's tool-definition quality score) and agents both read these.
//
// Descriptions stay factual: free/priced comes from each service's own
// /v1/status catalog at boot, never from guesses.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface Usage {
  /** When this is the right tool. */
  u: string;
  /** When it is not, and what to use instead. */
  n?: string;
}

const USAGE: Record<string, Usage> = {
  // --- Trading Data API (generated) ---
  price: { u: "you need the current spot price of one crypto asset or US stock/ETF.", n: "history or candles (use ohlcv), or a trading view (use momentum_score or verdict)." },
  ohlcv: { u: "you need historical candles to chart or compute indicators yourself.", n: "only the latest price (use price) or a ready-made indicator (atr, fvg, liquidity_levels)." },
  atr: { u: "you need volatility for position sizing or stops: Wilder ATR plus a low/normal/high/extreme regime.", n: "implied volatility for BTC/ETH (use volatility)." },
  fvg: { u: "you want Fair Value Gap zones (ICT-style imbalances) with fill status and distance from price.", n: "swing-high/low liquidity pools (use liquidity_levels)." },
  liquidity_levels: { u: "you want buy-side/sell-side liquidity levels and whether they were swept.", n: "gap zones (use fvg) or actual liquidation events (use liquidations)." },
  momentum_score: { u: "you want a ready-made LONG/SHORT/NEUTRAL view with confidence, thesis and entry/invalidation/targets for a supported asset.", n: "raw inputs (use price, atr, funding_oi). Same data as verdict, which is the newer name." },
  verdict: { u: "you want one call that returns a LONG/SHORT/NEUTRAL bias with a 0-10 confidence and a one-line thesis.", n: "the full structured levels (use momentum_score, an alias of the same engine) or raw inputs (use price, atr)." },
  funding_oi: { u: "you want perp funding rates and open interest aggregated from Binance and Bybit to gauge leverage and crowding.", n: "Hyperliquid-specific data (use hyperliquid) or spot-vs-perp carry (use basis)." },
  long_short_ratio: { u: "you want Binance positioning ratios (global accounts, top traders, taker buy/sell).", n: "funding or open interest (use funding_oi)." },
  orderbook: { u: "you need top-of-book depth and spread (bps) on Binance, Bybit or Hyperliquid.", n: "a prediction-market book (use kalshi_market)." },
  basis: { u: "you want the spot-vs-perp premium and funding-implied annualized carry for a basis trade.", n: "raw funding data (use funding_oi)." },
  hyperliquid: { u: "you need Hyperliquid perp context: funding, open interest, mark/oracle price, premium and volume.", n: "Binance/Bybit aggregates (use funding_oi)." },
  volatility: { u: "you want Deribit implied volatility (DVOL) next to realized volatility for BTC or ETH.", n: "other assets or ATR-style sizing (use atr)." },
  sentiment: { u: "you want the crypto Fear & Greed reading as a quick market-mood signal.", n: "asset-specific direction (use momentum_score)." },
  defi_tvl: { u: "you need DeFi TVL by chain, stablecoin supply or yield pools from DefiLlama.", n: "the health or risk of one protocol (use protocol_health_score)." },
  rates: { u: "you need the US Treasury yield curve and recession spreads (10y-2y, 10y-3m).", n: "event dates (use macro_calendar)." },
  market_clock: { u: "you need to know whether US equity markets are open and when the next session opens or closes.", n: "crypto, which trades 24/7." },
  market_overview: { u: "you want global crypto stats: total market cap, 24h volume, BTC and ETH dominance.", n: "a single asset's price (use price)." },
  gas: { u: "you need current Ethereum gas prices (safe, standard, fast) and the base fee before sending a transaction.", n: "other chains." },
  macro_calendar: { u: "you want upcoming US macro events (FOMC, CPI, jobs) with verified dates.", n: "company earnings (use earnings_calendar)." },
  earnings_calendar: { u: "you want upcoming US earnings dates, timing and analyst estimates.", n: "macro events (use macro_calendar) or filed reports (use filings_search)." },
  kalshi_probability: { u: "you want live Kalshi prediction-market probabilities by category or ticker.", n: "a single market's depth (use kalshi_market) or Polymarket (use polymarket)." },
  kalshi_market: { u: "you need one Kalshi market's orderbook and recent trades by ticker.", n: "browsing markets by category (use kalshi_probability)." },
  polymarket: { u: "you want Polymarket markets with live per-outcome probabilities and volume.", n: "Kalshi markets (use kalshi_probability)." },
  chain_balance: { u: "you need the native-token balance (ETH/POL) of an address or ENS name on Ethereum, Base, Arbitrum, Optimism or Polygon.", n: "token balances (use chain_token_balance) or a full holdings view (use wallet_portfolio)." },
  chain_token_balance: { u: "you need the balance of one ERC-20 token for an address or ENS name.", n: "native balance (chain_balance) or everything a wallet holds (wallet_portfolio)." },
  chain_nonce: { u: "you need an address's confirmed and pending transaction count before building a transaction.", n: "balances." },
  chain_block: { u: "you need a block header (number, hash, time, miner, gas, base fee), latest by default.", n: "a single transaction (use chain_tx)." },
  chain_ens: { u: "you need to resolve an ENS name to an address, or an address to its primary ENS name.", n: "non-ENS lookups." },
  chain_tx: { u: "you need the status and details of a transaction by hash.", n: "account-level data (use chain_balance or chain_nonce)." },
  wallet_portfolio: { u: "you want what a wallet holds in one call: native balance plus major ERC-20 tokens across supported chains.", n: "one specific token (use chain_token_balance) or counterparty risk (use wallet_check)." },
  web_search: { u: "an agent needs fresh web results with titles, URLs and snippets.", n: "verifying a claim (use sanity_check with mode open)." },
  crypto_news: { u: "you want the latest crypto headlines from major outlets, newest first.", n: "market data." },
  liquidations: { u: "you want recent forced liquidations on OKX USDT perpetuals for a coin, with side and size.", n: "liquidity pools (use liquidity_levels)." },
  // --- Protocol Health Oracle (generated) ---
  protocol_health_scoreboard: { u: "you want the free public ranking of every tracked DeFi protocol: name, score and verdict only.", n: "the component breakdown for one protocol (use protocol_health_score)." },
  protocol_health_list_protocols: { u: "you need every tracked protocol with its latest score and verdict.", n: "one protocol's details (use protocol_health_score)." },
  protocol_health_score: { u: "you are vetting one protocol before integrating it and want GitHub activity, TVL trend and treasury components.", n: "a ranking (use protocol_health_scoreboard) or token contract risk (use token_risk)." },
  protocol_health_track_protocol: { u: "a protocol you care about is not tracked yet and you want it scored from live GitHub and DefiLlama data.", n: "reading an existing score." },
  protocol_health_refresh_all: { u: "you need every tracked protocol re-scored right now instead of waiting for the schedule.", n: "a single protocol (read it with protocol_health_score)." },
  protocol_health_sync_universe: { u: "you want the tracked universe re-synced from DefiLlama (TVL above $1M), which also runs automatically on a schedule.", n: "routine reads." },
  // --- Token Risk / Filings / Wallet (generated) ---
  token_risk: { u: "you are about to buy or interact with a token contract and want honeypot, mint authority, holder and LP concentration and tax signals (EVM and Solana).", n: "wallet or address risk (use wallet_check) or protocol vetting (use protocol_health_score)." },
  filings_freshness: { u: "you want proof the SEC feed is live: seconds since the last poll and ingest lag.", n: "the filings themselves (use filings_search)." },
  filings_latest_preview: { u: "you want a free glimpse of the 10 most recent filings (form, company, ticker, time).", n: "full structured data (use filings_search)." },
  filings_search: { u: "you want structured SEC filings (8-K, Form 4, 13D/13G, 10-K, 10-Q) filtered by ticker, form or time.", n: "classified event alerts (use filings_8k_events) or insider trades (use filings_insider_trades)." },
  filings_8k_events: { u: "you want 8-K material events already classified (earnings, exec change, material agreement and similar).", n: "all form types (use filings_search)." },
  filings_insider_trades: { u: "you want individual Form 4 insider transactions, one row per trade.", n: "a per-ticker rollup (use filings_insider_summary)." },
  filings_insider_summary: { u: "you want a ticker's insider buying and selling rolled up over a window.", n: "the underlying trades (use filings_insider_trades)." },
  filings_filing: { u: "you have an accession number and want that one filing with parsed items and the SEC link.", n: "searching (use filings_search)." },
  wallet_sanctions_check: { u: "you need a free yes/no on whether an address is on the OFAC SDN sanctions list.", n: "broader counterparty risk (use wallet_check)." },
  wallet_check: { u: "you are about to transact and want a pre-transaction check of a wallet or contract: OFAC, malicious-address flags and on-chain signals.", n: "token contract safety (use token_risk)." },
  // --- Broker Sync (generated) ---
  broker_sync_register_user: { u: "you are onboarding a user and need a SnapTrade brokerage connection-portal URL.", n: "reading data for an already connected user." },
  broker_sync_connections: { u: "you want a user's connected brokerage accounts in a normalized shape.", n: "holdings (use broker_sync_positions) or cash (use broker_sync_balances)." },
  broker_sync_positions: { u: "you want a user's real positions across all connected brokerages in one schema.", n: "cash and buying power (use broker_sync_balances)." },
  broker_sync_balances: { u: "you want cash and buying power per connected account.", n: "holdings (use broker_sync_positions)." },
  broker_sync_transactions: { u: "you want a user's transaction and activity history across brokerages.", n: "current holdings (use broker_sync_positions)." },
  broker_sync_prop_firms: { u: "you want the registry of prop-firm platforms and which integration methods are live-verified.", n: "a user's own accounts (use broker_sync_connections)." },
  // --- Reputation ---
  reputation_status: { u: "you want one agent's tier, stake, reputation score and slash count before dealing with it.", n: "the event history (use reputation_statement) or a ranking (use reputation_leaderboard)." },
  reputation_statement: { u: "you need an agent's full position and ledger of stakes, unstakes, withdrawals and slashes.", n: "a quick tier check (use reputation_status)." },
  reputation_query: { u: "you want to filter or rank agents by tier, stake, reputation or slash history.", n: "one known wallet (use reputation_status)." },
  reputation_tiers: { u: "you want the live tier thresholds and benefits (minimum stake, rate-limit multiplier, fee discount).", n: "a specific agent's tier (use reputation_status)." },
  reputation_transparency: { u: "you want the treasury address, custody model, unbonding cooldown and totals, for example before staking.", n: "per-agent data." },
  reputation_leaderboard: { u: "you want the public ranking of agents by active stake, with tier and slash count.", n: "filtered searches (use reputation_query)." },
  reputation_history: { u: "you want how one agent's reputation and tier changed over time.", n: "current standing (use reputation_status)." },
  reputation_erc8004: { u: "you want to cross-reference a wallet against the open ERC-8004 identity and reputation registries.", n: "Wicked's own staking data (use reputation_status)." },
  reputation_get_nonce: { u: "you are about to register, stake, unstake or withdraw and need the one-time message to sign.", n: "read-only lookups, which need no signature." },
  reputation_register: { u: "you want to register your wallet as an agent, with your own signature over the nonce message.", n: "staking (use reputation_stake after funding the treasury)." },
  reputation_stake: { u: "you already sent USDC on-chain to the treasury and want that stake recorded, with its transaction hash and a signed nonce.", n: "moving funds, which this server never does." },
  reputation_unstake: { u: "you want to start the unbonding period for part of your active stake, with a signed nonce.", n: "collecting funds (use reputation_withdraw once the cooldown has passed)." },
  reputation_withdraw: { u: "your unbonding cooldown has elapsed and you want every matured stake paid out to your wallet.", n: "starting the unbonding (use reputation_unstake)." },
  // --- Registry ---
  registry_search_tools: { u: "you want to find x402/MCP tools filtered by category, protocol or minimum reliability score.", n: "a quick free check of a known tool (use registry_lookup)." },
  registry_tool_detail: { u: "you want one tool's full score breakdown and recent real health checks.", n: "finding tools (use registry_search_tools or registry_lookup)." },
  registry_lookup: { u: "you want a free lookup of a tool's id and headline score by name, URL fragment or exact endpoint before you call it.", n: "full detail (use registry_tool_detail)." },
  registry_featured_tools: { u: "you want the top-scored active tools with no key or payment.", n: "filtered search (use registry_search_tools)." },
  registry_tool_badge: { u: "you want one tool's current composite score as a free badge.", n: "the breakdown (use registry_tool_detail)." },
  registry_report_tool: { u: "a tool misbehaved and you want to file a complaint for manual review.", n: "reading scores." },
  registry_register_tool: { u: "you own a tool and want it listed and monitored, with your wallet's signature over the registration message.", n: "finding tools." },
  registry_onboarding_message: { u: "you are starting self-serve onboarding and need the exact message to sign.", n: "when you already have a signature (use registry_create_api_key or registry_register_tool)." },
  registry_create_api_key: { u: "you signed the onboarding message and want a free Registry API key (shown once).", n: "inspecting a key (use registry_key_info)." },
  registry_key_info: { u: "you want a Registry API key's label, creation time and usage counts.", n: "creating or revoking a key." },
  registry_revoke_key: { u: "a Registry API key leaked or is no longer needed and must be disabled permanently.", n: "inspecting a key (use registry_key_info)." },
  // --- Identity ---
  identity_get_nonce: { u: "you are about to register or take a challenge and need a fresh one-time message to sign.", n: "checking someone's status, which needs no signature." },
  identity_register: { u: "you want a lightweight identity record for your wallet, with a signature over the nonce message.", n: "proving you are an agent (use identity_get_challenge next)." },
  identity_get_challenge: { u: "your wallet is registered and you want the time-boxed agent-liveness challenge (about 12 seconds to answer).", n: "registering first (use identity_register)." },
  identity_submit_response: { u: "you have the challenge answer and want it scored and, on a pass, a signed assertion token.", n: "getting the challenge (use identity_get_challenge)." },
  identity_status: { u: "you want to know whether a wallet currently holds a valid, unexpired agent assertion.", n: "becoming verified (start with identity_get_nonce)." },
  identity_jwks: { u: "you want the public keys to verify an assertion token locally.", n: "checking a wallet's status (use identity_status)." },
  identity_sandbox_register: { u: "you have no wallet and want a sandbox identity to test the flow.", n: "production verification, which needs a real wallet signature." },
  identity_get_test_key: { u: "you are testing the Identity API and want a free test key for the sandbox.", n: "production use." },
  // --- Sanity ---
  sanity_check: { u: "you must verify one claim before acting on it, either against source text you supply or against live web evidence.", n: "many claims at once (use sanity_check_batch)." },
  sanity_check_batch: { u: "you have a multi-sentence output to verify against one shared context in a single call (up to 50 claims).", n: "a single claim (use sanity_check)." },
  sanity_get_check: { u: "you want to re-read an earlier check by its check_id.", n: "running a new check." },
  // --- Memory ---
  memory_prepare: { u: "you are about to call any other memory tool and need the exact message to sign for that request.", n: "the call itself." },
  memory_store: { u: "you want to save something for later, scoped to your wallet.", n: "changing an existing memory (use memory_update)." },
  memory_search: { u: "you want to recall your memories by meaning rather than by id.", n: "fetching a known id (use memory_get)." },
  memory_get: { u: "you have a memory id and want its content.", n: "searching by meaning (use memory_search)." },
  memory_update: { u: "you want to change a memory while keeping its history (a new version supersedes the old).", n: "removing it (use memory_delete)." },
  memory_history: { u: "you want a memory's full version chain and validity windows.", n: "its current content (use memory_get)." },
  memory_delete: { u: "you must permanently erase a memory (right to be forgotten).", n: "correcting it (use memory_update, which keeps history)." },
  memory_deletions: { u: "you want your audit log of deletions (ids, times, reasons, never content).", n: "recovering content, which is gone." },
  // --- Paywall ---
  paywall_demo_weather: { u: "you want to see a real x402 payment challenge from a paywalled route (price, network, payTo) without creating anything.", n: "setting up your own paywall (use paywall_signup then paywall_create_route)." },
  paywall_signup: { u: "you want a paywall tenant account and its API key (shown once).", n: "managing routes of an existing tenant." },
  paywall_get_tenant: { u: "you want your tenant record (name, slug, key hint).", n: "route management." },
  paywall_list_routes: { u: "you want your paywalled routes and their prices.", n: "earnings (use paywall_list_settlements)." },
  paywall_create_route: { u: "you want to put one HTTP endpoint behind x402 pay-per-call, paid in USDC straight to your wallet.", n: "many routes at once (use paywall_import_routes)." },
  paywall_import_routes: { u: "you want to paywall many routes in one call (upsert on method and path).", n: "a single route (use paywall_create_route)." },
  paywall_update_route: { u: "you want to change a route's price, payout wallet or upstream without a redeploy.", n: "creating or deleting routes." },
  paywall_delete_route: { u: "you want a route removed from the paywall.", n: "changing its price (use paywall_update_route)." },
  paywall_list_settlements: { u: "you want your real on-chain USDC settlements (earnings).", n: "route configuration (use paywall_list_routes)." },
};

const WRITES = new Set([
  "protocol_health_track_protocol", "protocol_health_refresh_all", "protocol_health_sync_universe", "broker_sync_register_user",
  "registry_register_tool", "registry_report_tool", "registry_create_api_key",
  "identity_get_nonce", "identity_register", "identity_get_challenge", "identity_submit_response", "identity_sandbox_register", "identity_get_test_key",
  "reputation_get_nonce", "reputation_register", "reputation_stake", "reputation_unstake", "reputation_withdraw",
  "sanity_check", "sanity_check_batch", "memory_store", "memory_update",
  "paywall_signup", "paywall_create_route", "paywall_import_routes", "paywall_update_route",
]);
const DESTRUCTIVE = new Set(["memory_delete", "paywall_delete_route", "registry_revoke_key", "reputation_unstake", "reputation_withdraw"]);
const IDEMPOTENT_WRITES = new Set(["paywall_update_route", "paywall_delete_route", "registry_revoke_key"]);
const LOCAL_ONLY = new Set(["memory_prepare"]);

export interface ToolContext {
  /** From the service's /v1/status: true means a priced or keyed endpoint. */
  priced?: boolean;
}

function humanize(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function annotationsFor(name: string) {
  const write = WRITES.has(name) || DESTRUCTIVE.has(name);
  return {
    title: humanize(name),
    readOnlyHint: !write,
    destructiveHint: DESTRUCTIVE.has(name),
    idempotentHint: !write || IDEMPOTENT_WRITES.has(name),
    openWorldHint: !LOCAL_ONLY.has(name),
  };
}

function behavior(name: string, ctx: ToolContext): string {
  if (LOCAL_ONLY.has(name)) return "Behavior: pure local computation, no network call, nothing is stored.";
  if (DESTRUCTIVE.has(name)) return "Behavior: DESTRUCTIVE and not reversible; confirm intent before calling.";
  if (WRITES.has(name)) return "Behavior: writes state upstream (not read-only); needs the credentials or wallet signature noted above where applicable.";
  if (ctx.priced === true) {
    return "Behavior: read-only. Priced via x402 (USDC on Base) or free with WICKEDAPI_API_KEY; with neither, you get HTTP 402 with the decoded price in payment_required (a price quote, not a failure).";
  }
  if (ctx.priced === false) return "Behavior: read-only and free; no key or payment needed.";
  return "Behavior: read-only.";
}

/** Final description: original text, then usage guidance, then behavior. */
export function describeTool(name: string, base: string, ctx: ToolContext = {}): string {
  const u = USAGE[name];
  const parts = [base.trim()];
  if (u) parts.push(`Use when ${u.u}${u.n ? ` Not for ${u.n}` : ""}`);
  parts.push(behavior(name, ctx));
  return parts.join("\n\n");
}

/** Wrap registerTool so every tool gets usage text and annotations. Call before registering. */
export function decorateRegistry(server: McpServer, priceOf: (tool: string) => boolean | undefined) {
  const original = (server as any).registerTool.bind(server);
  (server as any).registerTool = (name: string, config: any, handler: any) =>
    original(
      name,
      { ...config, description: describeTool(name, config.description ?? "", { priced: priceOf(name) }), annotations: annotationsFor(name) },
      handler
    );
}
