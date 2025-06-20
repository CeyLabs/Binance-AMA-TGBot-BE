import { Context } from "telegraf";

export interface AMA {
  id: string;
  session_no: number;
  language: "en" | "ar";
  date: string;
  time: string;
  total_pool: string;
  reward: string;
  winner_count: number;
  form_link: string;
  status: "pending" | "scheduled" | "broadcasted" | "active" | "ended";
  special_guest?: string;
  topic: string;
  hashtag: string;
  scheduled_at?: Date;
  thread_id?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface SessionData {
  editMode?: {
    sessionNo: number;
    field:
      | "date"
      | "time"
      | "sessionNo"
      | "reward"
      | "winnerCount"
      | "formLink"
      | "topic"
      | "guest";
    newValue?: string;
  };
}

export interface BotContext extends Context {
  session: SessionData;
}

interface Score {
  score: number;
  comment: string;
}

export interface OpenAIAnalysis {
  originality: Score;
  relevance: Score;
  clarity: Score;
  engagement: Score;
  language: Score;
  total_score: number;
}
