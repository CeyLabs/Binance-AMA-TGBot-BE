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
  topic?: string
): Promise<OpenAIAnalysis | string> {
  try {
    // pretty-ignore
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
          content: `Score the following user-submitted question based on 5 key factors:\n\n1. Originality – How unique or thoughtful the question is.\n2. Relevance to Topic – How closely it relates to the AMA topic.\n3. Clarity – How clearly the question is phrased.\n4. Engagement Potential – How likely it is to prompt an insightful or interesting answer.\n5. Language Quality – Grammar, spelling, and overall sentence construction.\n\nEach factor must be scored out of 10. Provide a short explanation for each score (1–2 sentences).\nThen calculate a total score out of 50.\n\n---\n\nAMA Context:\nHost: Binance MENA\nTopic: ${topic ?? "Weekly AMA"}\n\nUser-Submitted Question:\n\"${question}\"\n\nRespond in the following JSON format:\n\n{\n  \"originality\": {\n    \"score\": [0–10],\n    \"comment\": \"[Reasoning]\"\n  },\n  \"relevance\": {\n    \"score\": [0–10],\n    \"comment\": \"[Reasoning]\"\n  },\n  \"clarity\": {\n    \"score\": [0–10],\n    \"comment\": \"[Reasoning]\"\n  },\n  \"engagement\": {\n    \"score\": [0–10],\n    \"comment\": \"[Reasoning]\"\n  },\n  \"language\": {\n    \"score\": [0–10],\n    \"comment\": \"[Reasoning]\"\n  },\n  \"total_score\": [0–50]\n}`,
        },
      ],
    });

    const raw = response.output_text || "{}";
    const parsed: OpenAIAnalysis = JSON.parse(raw);

    return parsed;
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return "Analysis failed. Please try again later.";
  }
}
