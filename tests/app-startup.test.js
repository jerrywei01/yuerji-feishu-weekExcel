import test from "node:test";
import assert from "node:assert/strict";

import { shouldStartHttpServer } from "../src/app.js";

test("shouldStartHttpServer returns true for pm2 managed process", () => {
  const result = shouldStartHttpServer(
    ["node", "/usr/lib/node_modules/pm2/lib/ProcessContainerFork.js"],
    { pm_id: "0", NODE_ENV: "production" }
  );

  assert.equal(result, true);
});

test("shouldStartHttpServer returns false during tests", () => {
  const result = shouldStartHttpServer(
    ["node", "/home/ubuntu/srv/yuerji-feishu-weekExcel/src/app.js"],
    { NODE_ENV: "test" }
  );

  assert.equal(result, false);
});
