import OpenAI from "openai";
import { OpenAIAnalysis } from "../types";

const openAIClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get an AI-powered analysis of an AMA question
 * @param question The question to analyze
 * @param topic Optional topic context for the AMA
 * @returns Analysis with scores for originality, relevance, clarity, engagement potential, and language quality
 */
export async function getQuestionAnalysis(
  question: string,
  topic?: string,
): Promise<OpenAIAnalysis | string> {
  try {
    const response = await openAIClient.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are an expert content quality reviewer for a global crypto community. Your task is to evaluate user-submitted questions from AMA sessions. Use your expertise to assess the quality of each question based on five criteria: originality, relevance, clarity, engagement potential, and language quality. Provide scores out of 10 for each, a brief comment for each score, and a total score out of 50. Respond only in the JSON format provided.",
        },
        {
          role: "user",
          content: `Score the following user-submitted question based on 5 key factors:

1. Originality – How unique or thoughtful the question is.
2. Relevance to Topic – How closely it relates to the AMA topic.
3. Clarity – How clearly the question is phrased.
4. Engagement Potential – How likely it is to prompt an insightful or interesting answer.
5. Language Quality – Grammar, spelling, and overall sentence construction.

Each factor must be scored out of 10. Provide a short explanation for each score (1–2 sentences).
Then calculate a total score out of 50.

---

AMA Context:
Host: Binance MENA
Topic: ${topic ?? "Weekly AMA"}

User-Submitted Question:
"${question}"

Respond in the following JSON format:

{
  "originality": {
    "score": [0–10],
    "comment": "[Reasoning]"
  },
  "relevance": {
    "score": [0–10],
    "comment": "[Reasoning]"
  },
  "clarity": {
    "score": [0–10],
    "comment": "[Reasoning]"
  },
  "engagement": {
    "score": [0–10],
    "comment": "[Reasoning]"
  },
  "language": {
    "score": [0–10],
    "comment": "[Reasoning]"
  },
  "total_score": [0–50]
}`,
        },
      ],
    });

    let raw = response.output_text || "{}";

    // ✅ Strip markdown code block if it exists
    raw = raw
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(raw) as OpenAIAnalysis;
    return parsed;
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return "Analysis failed. Please try again later.";
  }
}
