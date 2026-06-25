import fs from "node:fs/promises";
import path from "node:path";

import { AIGenerator } from "../src/services/ai-generator.js";
import { SheetRenderer } from "../src/services/sheet-renderer.js";
import { validateRecordInput } from "../src/utils/validators.js";

const recordPath = path.resolve("examples", "demo-record.json");
const rawRecord = JSON.parse(await fs.readFile(recordPath, "utf8"));
const record = validateRecordInput(rawRecord);

const generator = new AIGenerator();
const aiResult = await generator.generate(record);

const aiDebugPath = path.resolve("outputs", "last-ai-result.json");
await fs.mkdir(path.dirname(aiDebugPath), { recursive: true });
await fs.writeFile(aiDebugPath, JSON.stringify(aiResult, null, 2), "utf8");

const renderer = new SheetRenderer();
const outputPath = await renderer.render(record, aiResult);

console.log(`AI Excel generated: ${outputPath}`);
console.log(`AI JSON saved: ${aiDebugPath}`);
