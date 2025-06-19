import { Context } from "telegraf";

export interface AMA {
  id: string;
  session_no: number;
  language: string;
  date: string;
  time: string;
  total_pool: string;
  reward: string;
  winner_count: number;
  form_link: string;
  status: string;
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
