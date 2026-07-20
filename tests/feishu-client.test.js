import test from "node:test";
import assert from "node:assert/strict";

import { FeishuClient } from "../src/services/feishu-client.js";

test("FeishuClient.deleteFile sends delete request with type=file", async () => {
  const calls = [];
  const client = new FeishuClient({
    fetchImpl: async (url, options = {}) => {
      calls.push([url, options]);

      if (String(url).includes("/auth/v3/tenant_access_token/internal")) {
        return new Response(
          JSON.stringify({
            code: 0,
            tenant_access_token: "tenant_token_1"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ code: 0, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  await client.deleteFile("file_token_1");

  assert.equal(calls[1][1].method, "DELETE");
  assert.match(String(calls[1][0]), /\/open-apis\/drive\/v1\/files\/file_token_1\?type=file$/);
});

test("FeishuClient refreshes tenant token after its reported lifetime", async () => {
  const authorizationHeaders = [];
  let authRequests = 0;
  let now = 1_000;
  const client = new FeishuClient({
    nowImpl: () => now,
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("/auth/v3/tenant_access_token/internal")) {
        authRequests += 1;
        return new Response(
          JSON.stringify({
            code: 0,
            tenant_access_token: `tenant_token_${authRequests}`,
            expire: 120
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      authorizationHeaders.push(options.headers.Authorization);
      return new Response(JSON.stringify({ code: 0, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  await client.deleteFile("file_token_1");
  now += 59_999;
  await client.deleteFile("file_token_2");
  now += 1;
  await client.deleteFile("file_token_3");

  assert.equal(authRequests, 2);
  assert.deepEqual(authorizationHeaders, [
    "Bearer tenant_token_1",
    "Bearer tenant_token_1",
    "Bearer tenant_token_2"
  ]);
});
