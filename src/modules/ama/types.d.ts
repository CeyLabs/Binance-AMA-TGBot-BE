import { UUID } from "crypto";
import { Context } from "telegraf";
import { SUPPORTED_LANGUAGES } from "./ama.constants";
import { EDITABLE_FIELDS } from "./new-ama/helper/field-metadata";

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type EditableFieldKey = keyof typeof EDITABLE_FIELDS;

export interface AMA {
  id: UUID;
  session_no: number;
  language: SupportedLanguage;
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
    amaId: UUID;
    field: EditableFieldKey;
    newValue?: string;
  };
  messagesToDelete?: number[];
  broadcastOptions?: {
    [amaId: UUID]: {
      [key: string]: boolean; // e.g., '5m': true
    };
  };
  discardedUsersByAMA?: Record<UUID, string[]>;
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

export interface User {
  user_id: string;
  name: string | null;
  username: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScoreData {
  id: UUID;
  ama_id: UUID;
  user_id: string;
  question: string;
  originality: number;
  relevance: number;
  clarity: number;
  engagement: number;
  language: number;
  score: number;
  created_at?: string;
  updated_at?: string;
}

// For creating new score records (without auto-generated ID)
export interface CreateScoreData {
  ama_id: UUID;
  user_id: string;
  question: string;
  originality: number;
  relevance: number;
  clarity: number;
  engagement: number;
  language: number;
  score: number;
}

// For queries that need user information with scores
export interface ScoreWithUser extends ScoreData {
  name: string | null;
  username: string | null;
}

export interface PublicGroupInfo {
  en: string;
  ar: string;
}

export interface GroupInfo {
  public: PublicGroupInfo;
  admin: string;
}

export interface WinnerData {
  id: UUID;
  ama_id: UUID;
  user_id: string;
  score_id: UUID;
  rank: number;
  created_at?: string;
  updated_at?: string;
}


export interface Schedule {
  id: UUID;
  ama_id: UUID;
  scheduled_time: Date;
  created_at: Date;
  updated_at: Date;
}

// For queries that need user information with winner data
export interface WinnerWithUser extends WinnerData {
  name: string | null;
  username: string | null;
}
