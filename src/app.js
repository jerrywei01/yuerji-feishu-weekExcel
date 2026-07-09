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

export function shouldStartHttpServer(argv = process.argv, envVars = process.env) {
  const isEntrypoint = argv[1] && pathToFileURL(argv[1]).href === import.meta.url;
  const isPm2Process = envVars.pm_id != null;
  return envVars.NODE_ENV !== "test" && (isEntrypoint || isPm2Process);
}

if (shouldStartHttpServer()) {
  app.listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
  });
}

export default app;
