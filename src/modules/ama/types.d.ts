import { UUID } from "crypto";
import { Context } from "telegraf";
import { SUPPORTED_LANGUAGES } from "./ama.constants";
import { EDITABLE_FIELDS } from "./helper/field-metadata";

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

export interface ScoreData {
  amaId: UUID;
  userId: string;
  userName: string;
  question: string;
  originality: number;
  relevance: number;
  clarity: number;
  engagement: number;
  language: number;
  score: number;
}

export interface PublicGroupIDs {
  en: string;
  ar: string;
}

export interface GroupIDs {
  public: PublicGroupIDs;
  admin: string;
}
