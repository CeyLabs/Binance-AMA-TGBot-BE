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
  status: "pending" | "broadcasted" | "active" | "ended";
  special_guest?: string;
  topic: string;
  hashtag: string;
  scheduled_at?: Date;
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
