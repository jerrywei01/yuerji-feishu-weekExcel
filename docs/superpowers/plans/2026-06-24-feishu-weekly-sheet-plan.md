# Feishu Weekly Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first runnable Node.js service that reads one Feishu Bitable record, asks AI for structured weekly-plan JSON, renders an Excel workbook, and prepares Feishu upload/import hooks.

**Architecture:** Keep the workflow linear and testable. Isolate Feishu API access, AI generation, validation, and Excel rendering into small modules so the job orchestrator can update record status and surface failures clearly.

**Tech Stack:** Node.js ESM, Express, OpenAI SDK, ExcelJS, Zod, node:test

---

### Task 1: Scaffold runtime and tests

**Files:**
- Create: `package.json`
- Create: `tests/weekly-plan.test.js`

- [x] **Step 1: Write the failing tests**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Keep scope to validator + renderer behavior**

### Task 2: Implement core modules

**Files:**
- Create: `src/app.js`
- Create: `src/controllers/generate-controller.js`
- Create: `src/routes/feishu.js`
- Create: `src/services/ai-generator.js`
- Create: `src/services/feishu-client.js`
- Create: `src/services/job-service.js`
- Create: `src/services/sheet-renderer.js`
- Create: `src/prompts/weekly-plan-prompt.js`
- Create: `src/utils/env.js`
- Create: `src/utils/logger.js`
- Create: `src/utils/validators.js`

- [ ] **Step 1: Implement validator used by tests**
- [ ] **Step 2: Implement renderer used by tests**
- [ ] **Step 3: Implement Feishu, AI, and HTTP workflow modules**

### Task 3: Verify end-to-end behavior

**Files:**
- Modify: `tests/weekly-plan.test.js`
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**
- [ ] **Step 2: Run `node --test`**
- [ ] **Step 3: Run a syntax check by importing the app entry**

