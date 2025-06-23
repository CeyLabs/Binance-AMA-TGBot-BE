import { EDIT_KEYS } from "../ama.constants";

export const EDITABLE_FIELDS = {
  [EDIT_KEYS.DATE]: {
    name: "Date",
    prompt: "Enter Date (dd/mm/yyyy)",
    column: "date",
    validate: (input: string) => {
      const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return null;
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`; // ISO format for DB
    },
  },
  [EDIT_KEYS.TIME]: {
    name: "Time",
    prompt: "Enter Time (HH:MM)",
    column: "time",
    validate: (input: string) => {
      const match = input.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)?$/i);
      if (!match) return null;
      let [, hour, minute, period] = match;
      let h = parseInt(hour, 10);
      if (period?.toUpperCase() === "PM" && h < 12) h += 12;
      if (period?.toUpperCase() === "AM" && h === 12) h = 0;
      return `${h.toString().padStart(2, "0")}:${minute}`;
    },
  },
  [EDIT_KEYS.SESSION_NO]: {
    name: "Session Number",
    prompt: "Enter Session Number",
    column: "session_no",
    validate: (input: string) => {
      const match = input.match(/^\d+$/);
      if (!match) return null;
      const sessionNo = parseInt(match[0], 10);
      return sessionNo > 0 ? sessionNo : null; // Ensure it's a positive integer
    },
  },
  [EDIT_KEYS.REWARD]: {
    name: "Reward",
    prompt: "Enter Reward (e.g., '33 USD')",
    column: "reward",
    validate: (input: string) => {
      const trimmed = input.trim();
      return trimmed.length > 0 ? trimmed : null; // Ensure it's not empty
    },
  },
  [EDIT_KEYS.WINNER_COUNT]: {
    name: "Winners Count",
    prompt: "Enter Number of Winners",
    column: "winner_count",
    validate: (input: string) => {
      const match = input.match(/^\d+$/);
      if (!match) return null;
      const count = parseInt(match[0], 10);
      return count > 0 ? count : null; // Ensure it's a positive integer
    },
  },
  [EDIT_KEYS.FORM_LINK]: {
    name: "Form Link",
    prompt: "Enter Form Link (e.g., 'https://example.com/form')",
    column: "form_link",
    validate: (input: string) => {
      const trimmed = input.trim();
      const urlPattern = /^(https?:\/\/)?([\w.-]+)(:[0-9]+)?(\/[\w.-]*)*\/?$/;
      return urlPattern.test(trimmed) ? trimmed : null; // Validate URL format
    },
  },
  [EDIT_KEYS.TOPIC]: {
    name: "Topic",
    prompt: "Enter Topic",
    column: "topic",
    validate: (input: string) => {
      const trimmed = input.trim();
      return trimmed.length > 0 ? trimmed : null; // Ensure it's not empty
    },
  },
  [EDIT_KEYS.GUEST]: {
    name: "Special Guest",
    prompt: "Enter Special Guest (optional)",
    column: "special_guest",
    validate: (input: string) => {
      const trimmed = input.trim();
      return trimmed.length > 0 ? trimmed : null; // Allow empty for no guest
    },
  },
} as const;
