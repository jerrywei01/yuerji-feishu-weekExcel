import fs from "node:fs/promises";
import path from "node:path";

import dayjs from "dayjs";
import ExcelJS from "exceljs";

import { extractBabyCard } from "./baby-profile-parser.js";
import {
  buildDynamicChecklistSections,
  buildFoodReference,
  buildFocusPointText,
  buildRoutineLines
} from "./checklist-layout.js";
import { env, hasTemplateFile } from "../utils/env.js";
import { buildDisplayTitle } from "../utils/plan-title.js";

const MAX_COL = 10;
const TASK_START_ROW = 9;
const NOTE_TEMPLATE_ROW = 23;
const SUMMARY_TEMPLATE_ROW = 24;
const RATE_TEMPLATE_ROW = 25;
const FOOD_HEADER_TEMPLATE_ROW = 26;
const FOOD_SUMMARY_TEMPLATE_ROW = 27;
const BASE_TASK_ROWS = 14;

const ROW_HEIGHT = {
  photo: 42,
  task: 22,
  note: 40,
  summary: 20,
  food: 26
};

export class SheetRenderer {
  constructor(options = {}) {
    this.templatePath = options.templatePath || env.templatePath;
    this.outputDir = options.outputDir || env.outputDir;
  }

  async render(input, aiResult) {
    const workbook = await this.createWorkbook();
    const templateSheet = workbook.worksheets[0];

    for (let index = 0; index < aiResult.weeks.length; index += 1) {
      const week = aiResult.weeks[index];
      const sheet = index === 0 ? templateSheet : workbook.addWorksheet(`第 ${week.week_no} 周`);

      if (index > 0) {
        this.copyTemplateSheet(templateSheet, sheet);
      }

      sheet.name = `第 ${week.week_no} 周`;
      this.fillWeekSheet(sheet, input, aiResult.baby, week);
    }

    await fs.mkdir(this.outputDir, { recursive: true });
    const fileBaseName = input.fileBaseName || buildDisplayTitle(input.babyName, input.babyStars);
    const fileName = `${sanitizeFileName(fileBaseName)}-${Date.now()}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async createWorkbook() {
    const workbook = new ExcelJS.Workbook();

    if (hasTemplateFile(this.templatePath)) {
      await workbook.xlsx.readFile(this.templatePath);
      return workbook;
    }

    const sheet = workbook.addWorksheet("第 1 周");
    this.seedFallbackTemplate(sheet);
    return workbook;
  }

  fillWeekSheet(sheet, input, baby, week) {
    const babyCard = extractBabyCard(input.babyProfile);
    const checklist = buildDynamicChecklistSections(week, input, babyCard);
    const foodReference = buildFoodReference(input.feedingPlan, 7);

    sheet.getCell("A1").value = input.displayTitle || buildDisplayTitle(input.babyName, input.babyStars);
    sheet.getCell("A2").value = `第 ${week.week_no} 周 ${formatDateRange(week.start_date, week.end_date)}`;
    sheet.getCell("A5").value = input.babyName;
    sheet.getCell("B5").value = babyCard.birthDate || normalizeDate(baby.birth_info_text);
    sheet.getCell("C5").value = babyCard.ageText || baby.age_text;
    sheet.getCell("D5").value = babyCard.feedingType || baby.feeding_type;
    sheet.getCell("A7").value = babyCard.birthWeight || "";
    sheet.getCell("B7").value = babyCard.birthHeight || "";
    sheet.getCell("C7").value = babyCard.stool || "";
    sheet.getCell("D7").value = babyCard.skin || "";
    sheet.getCell("E4").value = buildRoutineLines(week.routine_summary, input.routinePlan);
    sheet.getCell("H4").value = buildFocusPointText(input.stageSummary, week.focus_points);

    this.renderChecklistArea(sheet, checklist, foodReference);
  }

  renderChecklistArea(sheet, checklist, foodReference) {
    const taskRows = buildTaskRows(checklist);
    const extraRows = Math.max(0, taskRows.length - BASE_TASK_ROWS);
    const templateStyles = captureTemplateStyles(sheet, 8, 29);

    if (extraRows > 0) {
      sheet.spliceRows(SUMMARY_TEMPLATE_ROW, 0, ...Array.from({ length: extraRows }, () => []));
    }

    this.clearBodyArea(sheet);
    this.renderTaskRows(sheet, taskRows, templateStyles);

    const noteRow = TASK_START_ROW + taskRows.length;
    const summaryRow = noteRow + 1;
    const rateRow = noteRow + 2;
    const foodHeaderRow = noteRow + 3;
    const foodSummaryRow = noteRow + 4;

    this.renderNoteRow(sheet, noteRow, templateStyles);
    this.renderSummaryRows(sheet, taskRows.length, summaryRow, rateRow, templateStyles);
    this.renderFoodSummary(sheet, foodReference, foodHeaderRow, foodSummaryRow, templateStyles);
  }

  clearBodyArea(sheet) {
    const bottomRow = sheet.rowCount;

    for (const merge of Object.values(sheet._merges || {})) {
      const model = merge.model;
      if (model.top >= TASK_START_ROW && model.bottom <= bottomRow) {
        sheet.unMergeCells(toRange(model));
      }
    }

    for (let row = TASK_START_ROW; row <= bottomRow; row += 1) {
      sheet.getRow(row).height = undefined;
      for (let col = 1; col <= MAX_COL; col += 1) {
        const cell = sheet.getCell(row, col);
        cell.value = null;
        cell.style = {};
      }
    }
  }

  renderTaskRows(sheet, taskRows, templateStyles) {
    let currentCategory = "";
    let categoryStartRow = TASK_START_ROW;

    taskRows.forEach((row, index) => {
      const rowNumber = TASK_START_ROW + index;

      if (currentCategory && row.category !== currentCategory) {
        this.mergeCategoryLabel(sheet, currentCategory, categoryStartRow, rowNumber - 1);
        categoryStartRow = rowNumber;
      }

      this.copyRowStyle(sheet, templateStyles, row.templateRow, rowNumber);
      currentCategory = row.category;

      if (row.kind === "meal-start") {
        safeMerge(sheet, `B${rowNumber}:B${rowNumber + 2}`);
        sheet.getCell(`B${rowNumber}`).value = "三餐辅食\n（拍照上传）";
        sheet.getCell(`C${rowNumber}`).value = row.slotLabel;
        paintCellsFromTemplate(sheet, templateStyles, row.templateRow, rowNumber, ["A", "B", "C"]);
        sheet.getRow(rowNumber).height = ROW_HEIGHT.photo;
        return;
      }

      if (row.kind === "meal") {
        sheet.getCell(`C${rowNumber}`).value = row.slotLabel;
        paintCellsFromTemplate(sheet, templateStyles, row.templateRow, rowNumber, ["A", "B", "C"]);
        sheet.getRow(rowNumber).height = ROW_HEIGHT.photo;
        return;
      }

      safeMerge(sheet, `B${rowNumber}:C${rowNumber}`);
      sheet.getCell(`B${rowNumber}`).value = row.kind === "fixed-photo" ? `${row.text}（拍照上传）` : row.text;
      paintCellsFromTemplate(sheet, templateStyles, row.templateRow, rowNumber, ["A", "B", "C"]);
      sheet.getRow(rowNumber).height = row.kind === "fixed-photo" ? ROW_HEIGHT.photo : ROW_HEIGHT.task;
    });

    this.mergeCategoryLabel(sheet, currentCategory, categoryStartRow, TASK_START_ROW + taskRows.length - 1);
  }

  mergeCategoryLabel(sheet, category, startRow, endRow) {
    if (!category) return;
    if (endRow > startRow) {
      safeMerge(sheet, `A${startRow}:A${endRow}`);
    }
    sheet.getCell(`A${startRow}`).value = category;
  }

  renderNoteRow(sheet, rowNumber, templateStyles) {
    this.copyRowStyle(sheet, templateStyles, NOTE_TEMPLATE_ROW, rowNumber);
    safeMerge(sheet, `A${rowNumber}:C${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).value = "备注\n（宝宝异常状况、\n其他想说的可以在这备注）";
    sheet.getCell(`A${rowNumber}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(rowNumber).height = ROW_HEIGHT.note;
  }

  renderSummaryRows(sheet, taskCount, summaryRow, rateRow, templateStyles) {
    this.copyRowStyle(sheet, templateStyles, SUMMARY_TEMPLATE_ROW, summaryRow);
    this.copyRowStyle(sheet, templateStyles, RATE_TEMPLATE_ROW, rateRow);
    safeMerge(sheet, `A${summaryRow}:C${summaryRow}`);
    safeMerge(sheet, `A${rateRow}:C${rateRow}`);
    sheet.getCell(`A${summaryRow}`).value = `当日完成 / ${taskCount}`;
    sheet.getCell(`A${rateRow}`).value = "完成率";
    sheet.getRow(summaryRow).height = ROW_HEIGHT.summary;
    sheet.getRow(rateRow).height = ROW_HEIGHT.summary;

    const taskEndRow = TASK_START_ROW + taskCount - 1;
    for (let col = 4; col <= 10; col += 1) {
      const letter = sheet.getColumn(col).letter;
      sheet.getCell(summaryRow, col).value = { formula: `COUNTA(${letter}${TASK_START_ROW}:${letter}${taskEndRow})` };
      sheet.getCell(rateRow, col).value = { formula: `ROUND(${letter}${summaryRow}/${Math.max(taskCount, 1)}*100,2)&"%"` };
    }
  }

  renderFoodSummary(sheet, foodReference, headerRow, summaryRow, templateStyles) {
    this.copyRowStyle(sheet, templateStyles, FOOD_HEADER_TEMPLATE_ROW, headerRow);
    safeMerge(sheet, `A${headerRow}:J${headerRow}`);
    sheet.getCell(`A${headerRow}`).value = "辅食（参考）";
    sheet.getRow(headerRow).height = ROW_HEIGHT.summary;

    for (let i = 0; i < 3; i += 1) {
      this.copyRowStyle(sheet, templateStyles, FOOD_SUMMARY_TEMPLATE_ROW, summaryRow + i);
      sheet.getRow(summaryRow + i).height = ROW_HEIGHT.food;
    }

    safeMerge(sheet, `A${summaryRow}:J${summaryRow + 2}`);
    const cell = sheet.getCell(`A${summaryRow}`);
    cell.value = buildFoodSummaryText(foodReference);
    cell.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  }

  copyRowStyle(sheet, templateStyles, sourceRowNumber, targetRowNumber) {
    const rowTemplate = templateStyles.get(sourceRowNumber);
    const targetRow = sheet.getRow(targetRowNumber);
    targetRow.height = rowTemplate?.height;

    for (let col = 1; col <= MAX_COL; col += 1) {
      const sourceCell = rowTemplate?.cells?.get(col);
      const targetCell = sheet.getCell(targetRowNumber, col);
      targetCell.fill = cloneStylePart(sourceCell?.fill);
      targetCell.font = cloneStylePart(sourceCell?.font);
      targetCell.border = cloneStylePart(sourceCell?.border);
      targetCell.alignment = cloneStylePart(sourceCell?.alignment) || { wrapText: true, vertical: "middle" };
      targetCell.numFmt = sourceCell?.numFmt || "";
    }
  }

  copyTemplateSheet(source, target) {
    for (let rowIndex = 1; rowIndex <= source.rowCount; rowIndex += 1) {
      const sourceRow = source.getRow(rowIndex);
      const targetRow = target.getRow(rowIndex);
      targetRow.height = sourceRow.height;

      for (let colIndex = 1; colIndex <= source.columnCount; colIndex += 1) {
        const sourceCell = source.getCell(rowIndex, colIndex);
        const targetCell = target.getCell(rowIndex, colIndex);
        targetCell.value = sourceCell.value;
        targetCell.fill = cloneStylePart(sourceCell.fill);
        targetCell.font = cloneStylePart(sourceCell.font);
        targetCell.border = cloneStylePart(sourceCell.border);
        targetCell.alignment = cloneStylePart(sourceCell.alignment);
        targetCell.numFmt = sourceCell.numFmt;
      }
    }

    source.columns.forEach((column, index) => {
      target.getColumn(index + 1).width = column.width;
    });

    for (const merge of Object.values(source._merges || {})) {
      target.mergeCells(toRange(merge.model));
    }
  }

  seedFallbackTemplate(sheet) {
    sheet.getCell("A1").value = "御儿记VIP宝宝带养 · XX宝宝专属作息打卡表⭐";
    sheet.getCell("A2").value = "第 1 周 YYYY年MM月DD日至YYYY年MM月DD日";
  }
}

function buildTaskRows(checklist) {
  const feeding = findSection(checklist, "喂养");
  const exercise = findSection(checklist, "运动");
  const sleep = findSection(checklist, "睡眠");
  const care = findSection(checklist, "护理");

  return [
    { category: "喂养", kind: "meal-start", slotLabel: "早", templateRow: 9 },
    { category: "喂养", kind: "meal", slotLabel: "中", templateRow: 10 },
    { category: "喂养", kind: "meal", slotLabel: "晚", templateRow: 11 },
    ...feeding.rows.filter((row) => !row.mealGroup).map((row) => ({ category: "喂养", kind: "task", text: row.text, templateRow: 12 })),
    ...exercise.rows.map((row, index) => ({ category: "运动", kind: "task", text: row.text, templateRow: 13 + Math.min(index, 2) })),
    ...sleep.rows.map((row, index) => ({ category: "睡眠", kind: "task", text: row.text, templateRow: 16 + Math.min(index, 2) })),
    ...care.rows.map((row, index) => ({ category: "护理", kind: "task", text: row.text, templateRow: 19 + Math.min(index, 1) })),
    { category: "大便", kind: "fixed-photo", text: "大便情况", templateRow: 21 },
    { category: "皮肤", kind: "fixed-photo", text: "皮肤情况", templateRow: 22 }
  ];
}

function findSection(checklist, category) {
  return checklist.taskSections.find((section) => section.category === category) || { rows: [] };
}

function buildFoodSummaryText(foodReference) {
  const morning = summarizeMorning(foodReference.rows[0] || []);
  const noon = summarizeNoon(foodReference.rows[1] || []);
  const evening = summarizeEvening(foodReference.rows[2] || []);
  return [`上午：${morning}`, `中午：${noon}`, `晚上：${evening}`].join("\n");
}

function summarizeMorning(values) {
  const items = cleanValues(values);
  const grouped = groupMealExamples(items);
  return grouped.find((item) => item.startsWith("粥（例：")) || grouped.find((item) => item.startsWith("面（例：")) || grouped[0] || "粥/面";
}

function summarizeNoon(values) {
  const items = groupMealExamples(cleanValues(values));
  return items.slice(0, 4).join(" / ") || "面/粥/土豆泥/蔬菜泥";
}

function summarizeEvening(values) {
  const items = groupMealExamples(cleanValues(values));
  const hasChew = items.some((item) => item.includes("啃咬"));
  const base = items.find((item) => item.startsWith("面（例：")) || items.find((item) => item.includes("粥/面")) || "面（例：面条）";
  return hasChew ? `${stripChew(base)}+啃咬` : base;
}

function cleanValues(values) {
  return [...new Set(values.map((item) => normalizeFoodValue(item)).filter(Boolean))];
}

function normalizeFoodValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^面（例：面\)$/.test(text)) return "面（例：面条）";
  if (/^粥（例：粥\)$/.test(text)) return "粥（例：小米粥）";
  return text.replace(/\s+/g, " ");
}

function stripChew(value) {
  return String(value || "").replace(/\s*\/\s*啃咬/g, "").replace(/\s*啃咬/g, "").trim();
}

function groupMealExamples(items) {
  const grouped = new Map();
  const ordered = [];

  for (const item of items) {
    const match = item.match(/^([粥面])（例：(.+)）$/);
    if (!match) {
      if (!ordered.includes(item)) ordered.push(item);
      continue;
    }

    const key = match[1];
    const values = match[2]
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);

    if (!grouped.has(key)) {
      grouped.set(key, []);
      ordered.push(key);
    }

    const bucket = grouped.get(key);
    for (const value of values) {
      if (!bucket.includes(value)) bucket.push(value);
    }
  }

  return ordered.map((entry) => {
    if (!grouped.has(entry)) return entry;
    return `${entry}（例：${grouped.get(entry).join("/")}）`;
  });
}

function paintCellsFromTemplate(sheet, templateStyles, sourceRow, targetRow, columns) {
  columns.forEach((column) => {
    const sourceCell = templateStyles.get(sourceRow)?.cells?.get(columnIndex(column));
    const targetCell = sheet.getCell(`${column}${targetRow}`);
    targetCell.fill = cloneStylePart(sourceCell?.fill);
    targetCell.border = cloneStylePart(sourceCell?.border);
    targetCell.font = cloneStylePart(sourceCell?.font);
    targetCell.alignment = cloneStylePart(sourceCell?.alignment) || { wrapText: true, vertical: "middle" };
  });
}

function captureTemplateStyles(sheet, startRow, endRow) {
  const styles = new Map();
  for (let row = startRow; row <= endRow; row += 1) {
    const rowData = { height: sheet.getRow(row).height, cells: new Map() };
    for (let col = 1; col <= MAX_COL; col += 1) {
      const cell = sheet.getCell(row, col);
      rowData.cells.set(col, {
        fill: cloneStylePart(cell.fill),
        font: cloneStylePart(cell.font),
        border: cloneStylePart(cell.border),
        alignment: cloneStylePart(cell.alignment),
        numFmt: cell.numFmt
      });
    }
    styles.set(row, rowData);
  }
  return styles;
}

function cloneStylePart(value) {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*]/g, "_");
}

function formatDateRange(startDate, endDate) {
  return `${dayjs(startDate).format("YYYY 年 M 月 D 日")} 至 ${dayjs(endDate).format("YYYY 年 M 月 D 日")}`;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!match) return text;
  return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
}

function toRange(model) {
  return `${columnLetter(model.left)}${model.top}:${columnLetter(model.right)}${model.bottom}`;
}

function columnLetter(index) {
  let current = index;
  let output = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    current = Math.floor((current - 1) / 26);
  }
  return output;
}

function safeMerge(sheet, range) {
  try {
    sheet.mergeCells(range);
  } catch {
    const target = parseRange(range);
    for (const merge of Object.values(sheet._merges || {})) {
      if (rangesIntersect(merge.model, target)) {
        sheet.unMergeCells(toRange(merge.model));
      }
    }
    sheet.mergeCells(range);
  }
}

function parseRange(range) {
  const match = String(range).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  return {
    left: columnIndex(match[1]),
    top: Number(match[2]),
    right: columnIndex(match[3]),
    bottom: Number(match[4])
  };
}

function columnIndex(value) {
  return String(value)
    .split("")
    .reduce((sum, letter) => sum * 26 + (letter.charCodeAt(0) - 64), 0);
}

function rangesIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
