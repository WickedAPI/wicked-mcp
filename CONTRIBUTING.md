# Contributing

Bug reports and pull requests are welcome.

1. `npm install`
2. `npm test` builds, then runs the unit and end-to-end tests (the end-to-end tests call the live services).
3. New tools: add them in `src/suite.ts` (hand-written services) or let `src/server.ts` generate them from a
   service's OpenAPI spec. Add a "Use when / Not for" entry in `src/toolMeta.ts`; the tests fail if a tool is
   missing annotations or a behavior line.
4. Open a pull request. Keep changes focused; one concern per PR.

Tool descriptions are part of the product: say when to use a tool, when not to, and what it costs or changes.
