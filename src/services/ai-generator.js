import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";

import { buildWeeklyPlanPrompt } from "../prompts/weekly-plan-prompt.js";
import { env, requireLLMEnv } from "../utils/env.js";
import { validateAIResult } from "../utils/validators.js";

export class AIGenerator {
  constructor(options = {}) {
    this.client = options.client;
    this.model = options.model;
    this.provider = options.provider;
  }

  getClient() {
    if (this.client) return this.client;

    const config = requireLLMEnv();
    this.model = this.model || config.model;
    this.provider = this.provider || config.provider;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
    return this.client;
  }

  async generate(input) {
    const client = this.getClient();
    const payload = {
      model: this.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "你只输出合法 JSON。"
        },
        {
          role: "user",
          content: buildWeeklyPlanPrompt(input)
        }
      ]
    };

    // DeepSeek's OpenAI-compatible endpoint can be picky about response_format.
    if (this.provider !== "deepseek") {
      payload.response_format = { type: "json_object" };
    }

    const completion = await client.chat.completions.create(payload);
    const content = completion.choices?.[0]?.message?.content || "{}";

    await writeDebugFile("last-llm-response.txt", String(content || ""));

    const parsed = parseModelJson(content);
    return validateAIResult(parsed, input.weekCount);
  }
}

function parseModelJson(content) {
  const raw = String(content || "").trim();
  if (!raw) {
    throw new Error("模型返回为空，无法解析 JSON");
  }

  const candidates = [
    raw,
    stripCodeFence(raw),
    extractJSONObject(raw)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("模型返回的不是合法 JSON，请检查 outputs/last-llm-response.txt");
}

function stripCodeFence(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function extractJSONObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return "";
  }

  return text.slice(start, end + 1).trim();
}

async function writeDebugFile(fileName, content) {
  try {
    await fs.mkdir(env.outputDir, { recursive: true });
    await fs.writeFile(path.join(env.outputDir, fileName), content, "utf8");
  } catch {
    // Ignore debug write failures.
  }
}
