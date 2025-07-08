import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import * as path from "path";
import { AMA, ScoreWithUser } from "../../types";
import * as dayjs from "dayjs";

export interface CSVScoreData {
  rank: number;
  user_id: string;
  name: string;
  username: string;
  question: string;
  originality: number;
  clarity: number;
  engagement: number;
  total_score: number;
  submitted_at: string;
}

/**
 * Generate CSV file from AMA scores data
 * @param ama - AMA session data
 * @param scores - Array of score data with user info
 * @returns Promise<string> - Path to the generated CSV file
 */
export async function generateAMAScoresCSV(
  ama: AMA,
  scores: ScoreWithUser[],
): Promise<string> {
  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const filename = `AMA_${ama.session_no}_${ama.language}_scores_${timestamp}.csv`;
  const filePath = path.join(tempDir, filename);

  // Prepare CSV data with rankings
  const csvData: CSVScoreData[] = scores.map((score, index) => ({
    rank: index + 1,
    user_id: score.user_id,
    name: score.name || "",
    username: score.username || "",
    question: score.question.replace(/\n/g, " ").replace(/"/g, '""'), // Escape newlines and quotes
    originality: score.originality,
    clarity: score.clarity,
    engagement: score.engagement,
    total_score: score.score,
    submitted_at: score.created_at || "",
  }));

  // Define CSV headers
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: "rank", title: "Rank" },
      { id: "user_id", title: "User ID" },
      { id: "name", title: "Name" },
      { id: "username", title: "Username" },
      { id: "question", title: "Question" },
      { id: "originality", title: "Originality Score" },
      { id: "clarity", title: "Clarity Score" },
      { id: "engagement", title: "Engagement Score" },
      { id: "total_score", title: "Total Score" },
      { id: "submitted_at", title: "Submitted At" },
    ],
  });

  // Write CSV file
  await csvWriter.writeRecords(csvData);

  return filePath;
}

/**
 * Clean up temporary CSV files
 * @param filePath - Path to the CSV file to delete
 */
export function cleanupCSVFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error cleaning up CSV file:", error);
  }
}

/**
 * Get CSV file stats for Telegram sending
 * @param filePath - Path to the CSV file
 * @returns File stats including size and name
 */
export function getCSVFileStats(filePath: string): {
  size: number;
  name: string;
  exists: boolean;
} {
  try {
    if (!fs.existsSync(filePath)) {
      return { size: 0, name: "", exists: false };
    }

    const stats = fs.statSync(filePath);
    const name = path.basename(filePath);

    return {
      size: stats.size,
      name,
      exists: true,
    };
  } catch (error) {
    console.error("Error getting CSV file stats:", error);
    return { size: 0, name: "", exists: false };
  }
}
