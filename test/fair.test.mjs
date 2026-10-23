import test from "node:test";
import assert from "node:assert/strict";
import { _resetFairForTests, cacheGet, cacheKeyOf, cacheSet, fairSnapshot, reserveOpenMode, withClient } from "../dist/fair.js";

test("open-mode cap is per client per day, grounded is not involved, refusal explains the way out", () => {
  _resetFairForTests();
  process.env.OPEN_MODE_PER_CLIENT_PER_DAY = "3";
  withClient("1.1.1.1", () => {
    assert.equal(reserveOpenMode(2), null);
    assert.equal(reserveOpenMode(1), null);
    const refused = reserveOpenMode(1);
    assert.equal(refused.http_status, 429);
    assert.match(refused.error, /grounded/i);
    assert.equal(refused.remaining_today, 0);
  });
  withClient("2.2.2.2", () => assert.equal(reserveOpenMode(3), null)); // another client is unaffected
  assert.equal(reserveOpenMode(99), null); // no client context (stdio / tests): not gated
  assert.equal(fairSnapshot().unique_clients_today, 2);
  assert.equal(fairSnapshot().open_mode_refused, 1);
  delete process.env.OPEN_MODE_PER_CLIENT_PER_DAY;
});

test("a batch bigger than the whole allowance is refused without consuming it", () => {
  _resetFairForTests();
  process.env.OPEN_MODE_PER_CLIENT_PER_DAY = "5";
  withClient("3.3.3.3", () => {
    assert.equal(reserveOpenMode(6).http_status, 429);
    assert.equal(reserveOpenMode(5), null);
  });
  delete process.env.OPEN_MODE_PER_CLIENT_PER_DAY;
});

test("cache: hit before expiry, miss after, key depends on the whole request", () => {
  _resetFairForTests();
  const k = cacheKeyOf("POST", "https://x/check", '{"claim":"a"}');
  assert.equal(cacheGet(k, 1000), undefined);
  cacheSet(k, { ok: 1 }, 5000, 1000);
  assert.deepEqual(cacheGet(k, 3000), { ok: 1 });
  assert.equal(cacheGet(k, 7000), undefined);
  assert.notEqual(k, cacheKeyOf("POST", "https://x/check", '{"claim":"b"}'));
  const s = fairSnapshot();
  assert.equal(s.cache_hits, 1);
  assert.equal(s.cache_misses, 2);
});
