import { Router } from "express";

import { generateWeeklySheet } from "../controllers/generate-controller.js";

const router = Router();

router.post("/generate-weekly-sheet", generateWeeklySheet);

export default router;
