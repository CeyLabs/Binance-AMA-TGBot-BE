export const EDITABLE_FIELDS = {
  date: {
    prompt: "Enter Date (dd/mm/yyyy)",
    column: "date",
    validate: (input: string) => {
      const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return null;
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`; // ISO format for DB
    },
  },
  time: {
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
  // ... other fields
} as const;
