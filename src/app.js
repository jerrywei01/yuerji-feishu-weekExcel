import express from "express";
import { pathToFileURL } from "node:url";

import { env } from "./utils/env.js";
import feishuRoutes from "./routes/feishu.js";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use("/api/feishu", feishuRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const isEntrypoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (process.env.NODE_ENV !== "test" && isEntrypoint) {
  app.listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
  });
}

export default app;
