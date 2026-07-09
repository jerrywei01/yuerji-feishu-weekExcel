import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";

import { extractBabyCard } from "../src/services/baby-profile-parser.js";
import {
  buildDynamicChecklistSections,
  buildFoodReference,
  buildFocusPointText,
  buildRoutineLines
} from "../src/services/checklist-layout.js";
import { SheetRenderer } from "../src/services/sheet-renderer.js";
import { validateAIResult } from "../src/utils/validators.js";

test("validateAIResult rejects mismatched week counts", () => {
  const payload = {
    baby: {
      name: "小满",
      birth_info_text: "2025-05-09",
      age_text: "1Y1M14D",
      feeding_type: "适度水解奶粉",
      body_text: "17.4斤 / 72cm"
    },
    weeks: [
      {
        week_no: 1,
        title: "第1周",
        start_date: "2026-06-24",
        end_date: "2026-06-30",
        routine_summary: "作息摘要",
        focus_points: ["重点1"],
        card_items: {
          feeding: ["早餐"],
          exercise: ["上午户外"],
          sleep: ["午觉"],
          care: ["泡瑶浴"]
        }
      }
    ]
  };

  assert.throws(() => validateAIResult(payload, 2), /周数/);
});

test("extractBabyCard parses top card fields from profile text", () => {
  const profile = `
宝宝信息：
出生年月日：2025年7月11日
昵称：小满
性别：男
出生体重3.3kg
出生身高51cm
目前月龄1月9天
目前体重9斤
目前身高56cm
大便：一天1-2次，有黏液、稀便（大便、皮肤皮疹拍照发给助教老师）
皮肤情况：四肢及身体湿疹；反复结痂（大便、皮肤皮疹拍照发给助教老师）
喂养史：母乳
辅食添加：未添加
`;

  const card = extractBabyCard(profile);

  assert.equal(card.birthDate, "2025/07/11");
  assert.equal(card.ageText, "1月9天");
  assert.equal(card.feedingType, "母乳");
  assert.equal(card.birthWeight, "3.3kg");
  assert.equal(card.birthHeight, "51cm");
  assert.equal(card.stool, "一天1-2次，有黏液、稀便");
  assert.equal(card.skin, "四肢及身体湿疹，反复结痂");
});

test("extractBabyCard summarizes stool and skin text without photo reminder", () => {
  const profile = `
宝宝信息：
出生年月日：2025年5月1日
昵称：洋洋
出生体重3.1kg
出生身高50cm
目前月龄1岁1个月
大便：成型软便（26.6.6开始换的部分水解蛋白奶粉，换奶粉的这几天大便形态比较稳定，换奶之前，大便有时候偏干，有时候偏稀，有时候是带裂纹香肠状的，前干后软，有时又是不成型稀便）（三天以上的大便情况）
皮肤情况：下眼睑有时候微微泛红，有时候感觉还好，肛周容易起红色疹子，近几个月时间老是容易反复，每天都有用护臀膏，肛周皮肤近几个月时间老是容易泛红（好像从第一次吃头孢，拉肚子屁股长疹子后，后面就反复了好几次了）。（大便、皮肤皮疹拍照发给助教老师）
喂养史：配方奶
`;

  const card = extractBabyCard(profile);

  assert.match(card.stool, /成型软便/);
  assert.match(card.stool, /偏干|偏稀|不成型/);
  assert.ok(!/拍照|助教老师/.test(card.stool));
  assert.match(card.skin, /下眼睑/);
  assert.match(card.skin, /肛周/);
  assert.match(card.skin, /泛红|红色疹子|反复/);
  assert.ok(!/拍照|助教老师/.test(card.skin));
});

test("layout helpers keep note guidance, dedupe outdoor tasks, and summarize food text", () => {
  const week = {
    week_no: 1,
    focus_points: ["添加益生菌4周", "户外活动每天两次"],
    card_items: {
      feeding: ["10:00 小米油60-80g+啃咬", "12:00 午餐饭菜+啃咬", "18:00 晚餐+啃咬"],
      exercise: ["户外活动", "抚触按摩"],
      sleep: ["午觉（约1.5-2小时）"],
      care: ["泡瑶浴", "益生菌"]
    }
  };
  const input = {
    feedingPlan: "第1天：上午：粥/面（例：小米粥/猪肉青菜面）；中午：面（例：碎肉青菜面条）/粥（例：红薯红枣粥）/土豆泥/蔬菜泥/面（例：西兰花碎肉面）；晚上：面（例：面)+啃咬",
    bathPlan: "第一周：泡两天的健包+一天退包",
    stageSummary: "添加益生菌4周，调整肠道菌群。足量户外运动+晒太阳+足量按摩。",
    routinePlan: "8:00户外活动、晒太阳、按摩、俯趴等等\n15:00-15:30起床、喂奶、拍嗝、抚触按摩、俯趴等、户外"
  };
  const babyCard = {
    stool: "一天1-2次，有黏液、稀便",
    skin: "四肢及身体湿疹；反复结痂",
    ageText: "1月9天"
  };

  const checklist = buildDynamicChecklistSections(week, input, babyCard);
  const routineLines = buildRoutineLines("", "17:30 黄昏觉（约30分钟）\n18:00-18:30 小米油/五果粉 + 啃咬");
  const detailedRoutineLines = buildRoutineLines(
    "",
    "7-7点半喝奶150ml+包子或馒头或面饼。（早上不吃鸡蛋）\n8点-11点户外活动、市场买菜、玩耍，10-10点半左右给两天小米油，一天玉米汁交替着喝60-80g+啃咬。\n约8点左右喂奶150-210ml左右，这餐奶不定量，比如今晚给的是150ml能5分钟左右很快就喝完了，那么下一晚的时候就要增加10ml给。"
  );
  const focusText = buildFocusPointText(input.stageSummary, week.focus_points);
  const foodReference = buildFoodReference(input.feedingPlan, 1);
  const exerciseRows = checklist.taskSections.find((section) => section.category === "运动").rows.map((row) => row.text);

  assert.equal(checklist.noteText, "备注\n（宝宝异常状况、\n其他想说的可以在这备注）");
  assert.ok(exerciseRows.includes("户外活动（上午）"));
  assert.ok(exerciseRows.includes("户外活动（下午）"));
  assert.ok(!exerciseRows.includes("户外活动"));
  assert.ok(exerciseRows.includes("抚触按摩"));
  assert.match(routineLines, /17:30 黄昏觉/);
  assert.match(detailedRoutineLines, /07:00-07:30 喝奶150ml\+包子或馒头或面饼/);
  assert.match(detailedRoutineLines, /08:00-11:00 户外活动、市场买菜、玩耍/);
  assert.match(detailedRoutineLines, /20:00 喂奶150-210ml左右/);
  assert.ok(!/比如今晚/.test(detailedRoutineLines));
  assert.match(focusText, /关注肠道调理和大便变化/);
  assert.equal(
    foodReference.summaryText,
    "第1天：上午：粥/面（例：小米粥/猪肉青菜面）；中午：面（例：碎肉青菜面条）/粥（例：红薯红枣粥）/土豆泥/蔬菜泥/面（例：西兰花碎肉面）；晚上：面（例：面)+啃咬"
  );
});

test("SheetRenderer preserves colored merged sections, photo upload rows, guided note label, and merged food summary", async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuerji-render-"));
  const renderer = new SheetRenderer({
    templatePath: path.resolve(".tmp", "template.xlsx"),
    outputDir: workDir
  });

  const filePath = await renderer.render(
    {
      recordId: "rec_1",
      planTitle: "小满-阶段方案",
      motherName: "洪钱蓉",
      babyName: "小满",
      babyProfile: `
宝宝信息：
出生年月日：2025年7月11日
昵称：小满
出生体重3.3kg
出生身高51cm
目前月龄1月9天
大便：一天1-2次，有黏液、稀便
皮肤情况：四肢及身体湿疹；反复结痂
喂养史：母乳
辅食添加：未添加
`,
      stageSummary: "添加益生菌4周，调整肠道菌群。足量户外运动+晒太阳+足量按摩。约3-4周后根据大便情况看是否添加低体重奶粉。",
      routinePlan: "8:00户外活动、晒太阳、按摩、俯趴等等\n15:00-15:30起床、喂奶、拍嗝、抚触按摩、俯趴等、户外\n19:00-19:30喂奶、按摩、哄睡",
      feedingPlan: "第1天：上午：粥（例：小米粥）；中午：面（例：碎肉青菜面条）/粥（例：红薯红枣粥）/土豆泥/蔬菜泥/面（例：西兰花碎肉面）；晚上：面（例：面)+啃咬",
      bathPlan: "第一周：泡两天的健包+一天退包",
      recordDate: "2026-06-22",
      planStartDate: "2026-06-24",
      weekCount: 1
    },
    {
      baby: {
        name: "小满",
        birth_info_text: "错误示例",
        age_text: "错误月龄",
        feeding_type: "错误喂养方式",
        body_text: "错误身体摘要"
      },
      weeks: [
        {
          week_no: 1,
          title: "第1周",
          start_date: "2026-06-24",
          end_date: "2026-06-30",
          routine_summary: "旧作息摘要",
          focus_points: ["添加益生菌4周", "户外活动每天两次", "观察大便情况"],
          card_items: {
            feeding: ["10:00 小米油60-80g+啃咬", "12:00 午餐饭菜+啃咬", "18:00 晚餐+啃咬", "辅食宝"],
            exercise: ["户外活动", "抚触按摩"],
            sleep: ["午觉（约1.5-2小时）"],
            care: ["泡瑶浴", "益生菌", "温敷肚子"]
          }
        }
      ]
    }
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const noteRow = findRow(sheet, (row) => String(row.getCell(1).value || "").startsWith("备注"));
  const stoolRow = findRow(sheet, (row) => String(row.getCell(1).value || "") === "大便");
  const foodHeaderRow = findRow(sheet, (row) => String(row.getCell(1).value || "") === "辅食（参考）");
  const taskTexts = Array.from({ length: 30 }, (_, index) => String(sheet.getCell(`B${index + 9}`).value || ""));

  assert.equal(sheet.getCell("B9").value, "三餐辅食\n（拍照上传）");
  assert.equal(sheet.getCell("C9").value, "早");
  assert.ok(sheet.getCell("B10").isMerged);
  assert.ok(sheet.getCell("A10").isMerged);
  assert.equal(sheet.getCell("B12").value, "规律喂奶");
  assert.ok(taskTexts.includes("抚触按摩"));
  assert.ok(taskTexts.includes("户外活动（上午）"));
  assert.ok(taskTexts.includes("户外活动（下午）"));
  assert.equal(taskTexts.filter((item) => item === "户外活动").length, 0);
  assert.equal(sheet.getCell(`B${stoolRow}`).value, "大便情况（拍照上传）");
  assert.equal(sheet.getCell(`A${noteRow}`).value, "备注\n（宝宝异常状况、\n其他想说的可以在这备注）");
  assert.ok((sheet.getRow(9).height || 0) >= 40);
  assert.ok((sheet.getRow(12).height || 0) < 30);
  assert.ok((sheet.getRow(stoolRow).height || 0) >= 40);
  assert.equal(sheet.getCell(`A${foodHeaderRow}`).value, "辅食（参考）");
  assert.equal(
    String(sheet.getCell(`A${foodHeaderRow + 1}`).value || ""),
    "第1天：上午：粥（例：小米粥）；中午：面（例：碎肉青菜面条）/粥（例：红薯红枣粥）/土豆泥/蔬菜泥/面（例：西兰花碎肉面）；晚上：面（例：面)+啃咬"
  );
});

test("SheetRenderer tolerates pre-merged template cells without throwing merge conflicts", async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuerji-merge-"));
  const templatePath = path.join(workDir, "template.xlsx");

  const templateBook = new ExcelJS.Workbook();
  await templateBook.xlsx.readFile(path.resolve(".tmp", "template.xlsx"));
  const templateSheet = templateBook.worksheets[0];
  templateSheet.unMergeCells("A9:A12");
  templateSheet.unMergeCells("B9:B11");
  templateSheet.unMergeCells("A26:J26");
  templateSheet.mergeCells("A9:C9");
  templateSheet.mergeCells("A26:J26");
  await templateBook.xlsx.writeFile(templatePath);

  const renderer = new SheetRenderer({
    templatePath,
    outputDir: workDir
  });

  const renderPromise = renderer.render(
    {
      recordId: "rec_2",
      planTitle: "merge-test",
      motherName: "测试妈妈",
      babyName: "测试宝宝",
      babyProfile: `
宝宝信息：出生年月日：2025年5月1日
出生体重3.3kg
出生身高51cm
目前月龄1岁1个月
大便：一天1-2次
皮肤情况：正常
喂养史：母乳
`,
      stageSummary: "添加益生菌4周，足量户外运动+按摩。",
      routinePlan: "7-7点半喝奶150ml+包子。8点-11点户外活动。12点午饭+午觉。15点起床奶。18点晚饭。20点喂奶。",
      feedingPlan: "吃短期食物，加油盐，多吃薯类、洋葱、莲藕等，加餐给吃小米油、五果粉、玉米汁、芝麻糊等。",
      bathPlan: "第一周：泡两天的健包+一天退包",
      recordDate: "2026-07-09",
      planStartDate: "2026-07-09",
      weekCount: 1
    },
    {
      baby: {
        name: "测试宝宝",
        birth_info_text: "2025/05/01",
        age_text: "1Y1M",
        feeding_type: "母乳",
        body_text: ""
      },
      weeks: [
        {
          week_no: 1,
          title: "第1周",
          start_date: "2026-07-09",
          end_date: "2026-07-15",
          routine_summary: "作息摘要",
          focus_points: ["重点1"],
          card_items: {
            feeding: ["10:00 小米油", "12:00 午饭", "18:00 晚饭", "加餐", "啃咬"],
            exercise: ["户外活动", "抚触按摩"],
            sleep: ["午觉"],
            care: ["泡瑶浴", "益生菌"]
          }
        }
      ]
    }
  );

  await assert.doesNotReject(renderPromise);
});

function findRow(sheet, predicate) {
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (predicate(row)) return rowNumber;
  }
  return -1;
}
