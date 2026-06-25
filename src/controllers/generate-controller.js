import { JobService } from "../services/job-service.js";
import { generateRequestSchema } from "../utils/validators.js";

const jobService = new JobService();

export async function generateWeeklySheet(req, res) {
  try {
    const { record_id: recordId } = generateRequestSchema.parse(req.body);
    const result = await jobService.run(recordId);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
}
