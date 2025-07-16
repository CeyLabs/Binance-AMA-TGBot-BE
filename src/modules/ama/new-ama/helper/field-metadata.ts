import { EDIT_KEYS } from "../../ama.constants";

type ValidationResult = {
  value: string | number | null;
  error?: string;
};

export const EDITABLE_FIELDS = {
  [EDIT_KEYS.DATE]: {
    name: "Date",
    prompt: "Enter Date (dd/mm/yyyy)",
    column: "date",
    validate: (input: string): ValidationResult => {
      const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return { value: null, error: "❌ Invalid format. Use dd/mm/yyyy." };

      const [, day, month, year] = match;
      const iso = `${year}-${month}-${day}`;
      const inputDate = new Date(iso);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isNaN(inputDate.getTime())) {
        return { value: null, error: "❌ Invalid date." };
      }

      if (inputDate < today) {
        return { value: null, error: "❌ Date must not be in the past." };
      }

      return { value: iso };
    },
  },

  [EDIT_KEYS.TIME]: {
    name: "Time",
    prompt: "Enter Time (HH:MM or HH:MM AM/PM)",
    column: "time",
    validate: (input: string): ValidationResult => {
      const match = input.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)?$/i);
      if (!match)
        return {
          value: null,
          error: "❌ Invalid time format. Use HH:MM or HH:MM AM/PM.",
        };

      const [, hour, minute, period] = match;
      let h = parseInt(hour, 10);
      if (period?.toUpperCase() === "PM" && h < 12) h += 12;
      if (period?.toUpperCase() === "AM" && h === 12) h = 0;

      if (h < 0 || h > 23 || parseInt(minute, 10) > 59) {
        return { value: null, error: "❌ Invalid time values." };
      }

      // Add seconds to the time format to match HH:MM:SS format
      return { value: `${h.toString().padStart(2, "0")}:${minute}:00` };
    },
  },

  [EDIT_KEYS.SESSION_NO]: {
    name: "Session Number",
    prompt: "Enter Session Number",
    column: "session_no",
    validate: (input: string): ValidationResult => {
      const match = input.match(/^\d+$/);
      if (!match)
        return {
          value: null,
          error: "❌ Session number must be a positive integer.",
        };
      const sessionNo = parseInt(match[0], 10);
      return sessionNo > 0
        ? { value: sessionNo }
        : {
            value: null,
            error: "❌ Session number must be greater than zero.",
          };
    },
  },

  [EDIT_KEYS.REWARD]: {
    name: "Reward",
    prompt: "Enter Reward (e.g., '33 USD')",
    column: "reward",
    validate: (input: string): ValidationResult => {
      const trimmed = input.trim();
      return trimmed.length > 0
        ? { value: trimmed }
        : { value: null, error: "❌ Reward cannot be empty." };
    },
  },
  [EDIT_KEYS.TOTAL_POOL]: {
    name: "Total Pool",
    prompt: "Enter Total Pool (e.g., '1000 USD')",
    column: "total_pool",
    validate: (input: string): ValidationResult => {
      const trimmed = input.trim();
      return trimmed.length > 0
        ? { value: trimmed }
        : { value: null, error: "❌ Total pool cannot be empty." };
    },
  },

  [EDIT_KEYS.WINNER_COUNT]: {
    name: "Winners Count",
    prompt: "Enter Number of Winners",
    column: "winner_count",
    validate: (input: string): ValidationResult => {
      const match = input.match(/^\d+$/);
      if (!match) return { value: null, error: "❌ Winner count must be a number." };
      const count = parseInt(match[0], 10);
      return count > 0
        ? { value: count }
        : { value: null, error: "❌ Winner count must be greater than zero." };
    },
  },

  [EDIT_KEYS.FORM_LINK]: {
    name: "Form Link",
    prompt: "Enter Form Link (e.g., 'https://example.com/form')",
    column: "form_link",
    validate: (input: string): ValidationResult => {
      const trimmed = input.trim();
      const urlPattern = /^https?:\/\/[^\s]+$/;
      return urlPattern.test(trimmed)
        ? { value: trimmed }
        : { value: null, error: "❌ Invalid URL format." };
    },
  },

  [EDIT_KEYS.TOPIC]: {
    name: "Topic",
    prompt: "Enter Topic",
    column: "topic",
    validate: (input: string): ValidationResult => {
      const trimmed = input.trim();
      return trimmed.length > 0
        ? { value: trimmed }
        : { value: null, error: "❌ Topic cannot be empty." };
    },
  },

  [EDIT_KEYS.GUEST]: {
    name: "Special Guest",
    prompt: "Enter Special Guest (optional)",
    column: "special_guest",
    validate: (input: string): ValidationResult => {
      const trimmed = input.trim();
      return { value: trimmed.length > 0 ? trimmed : null };
    },
  },

  [EDIT_KEYS.BANNER]: {
    name: "Banner Image",
    prompt: "Please send the banner image for the AMA announcement",
    column: "banner_file_id",
    validate: (input: string): ValidationResult => {
      if (!input) {
        return { value: null, error: "❌ Please send a valid image." };
      }
      return { value: input };
    },
  },
} as const;
