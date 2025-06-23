export const AMA_COMMANDS = {
  NEW: "newama",
  START: "startama",
  END: "endama",
};

export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;

export const AMA_HASHTAG = "BinanceWeeklySessions";

export const EDIT_KEYS = {
  DATE: "date",
  TIME: "time",
  SESSION_NO: "sessionNo",
  REWARD: "reward",
  WINNER_COUNT: "winnerCount",
  FORM_LINK: "formLink",
  TOPIC: "topic",
  GUEST: "guest",
};

export const CALLBACK_ACTIONS = {
  // Callback actions for AMA management
  EDIT_DATE: `edit-${EDIT_KEYS.DATE}`,
  EDIT_TIME: `edit-${EDIT_KEYS.TIME}`,
  EDIT_SESSION: `edit-${EDIT_KEYS.SESSION_NO}`,
  EDIT_REWARD: `edit-${EDIT_KEYS.REWARD}`,
  EDIT_WINNERS: `edit-${EDIT_KEYS.WINNER_COUNT}`,
  EDIT_FORM: `edit-${EDIT_KEYS.FORM_LINK}`,
  ADD_TOPIC: `edit-${EDIT_KEYS.TOPIC}`,
  ADD_GUEST: `edit-${EDIT_KEYS.GUEST}`,
  CANCEL: "cancel-ama",
  CONFIRM: "confirm-ama",

  // Callback actions for broadcast management
  SCHEDULE_BROADCAST: "schedule-broadcast",
  BROADCAST_NOW: "broadcast-now",
  CANCEL_BROADCAST: "cancel-broadcast",

  // Callback actions for edit confirmation
  EDIT_CONFIRM: "edit-confirm",
  EDIT_CANCEL: "edit-cancel",
};

export const AMA_DEFAULT_DATA = {
  date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0], // one day from now
  // Example: "08:00pm KSA"
  time: "20:00:00",
  total_pool: "100 FDUSD",
  reward: "33.3 FDUSD",
  winner_count: 3,
  form_link: "https://example.com/form",
};
