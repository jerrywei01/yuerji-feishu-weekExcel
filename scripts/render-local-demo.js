import fs from "node:fs/promises";
import path from "node:path";

import { SheetRenderer } from "../src/services/sheet-renderer.js";

const recordPath = path.resolve("examples", "demo-record.json");
const aiResultPath = path.resolve("examples", "demo-ai-result.json");

const record = JSON.parse(await fs.readFile(recordPath, "utf8"));
const aiResult = JSON.parse(await fs.readFile(aiResultPath, "utf8"));

const renderer = new SheetRenderer();
const outputPath = await renderer.render(record, aiResult);

console.log(`Mock Excel generated: ${outputPath}`);
