import * as dayjs from "dayjs";

export const AMA_COMMANDS = {
  NEW: "newama",
  START: "startama",
  END: "endama",
  SELECT_WINNERS: "selectwinners",
};

export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;

export const AMA_HASHTAGS = {
  en: "BinanceSession",
  ar: "جلسات_بينانس",
};

export const EDIT_KEYS = {
  DATE: "date",
  TIME: "time",
  SESSION_NO: "sessionNo",
  REWARD: "reward",
  WINNER_COUNT: "winnerCount",
  TOTAL_POOL: "totalPool",
  FORM_LINK: "formLink",
  TOPIC: "topic",
  GUEST: "guest",
  BANNER: "banner",
};

export const HIDDEN_KEYS = {
  SUBSCRIBE_EN: "subscribe_en",
  SUBSCRIBE_AR: "subscribe_ar",
};

export const CALLBACK_ACTIONS = {
  // Callback actions for AMA management
  EDIT_DATE: `edit-${EDIT_KEYS.DATE}`,
  EDIT_TIME: `edit-${EDIT_KEYS.TIME}`,
  EDIT_SESSION: `edit-${EDIT_KEYS.SESSION_NO}`,
  EDIT_REWARD: `edit-${EDIT_KEYS.REWARD}`,
  EDIT_WINNERS: `edit-${EDIT_KEYS.WINNER_COUNT}`,
  EDIT_TOTAL_POOL: `edit-${EDIT_KEYS.TOTAL_POOL}`,
  EDIT_BANNER: `edit-${EDIT_KEYS.BANNER}`,
  EDIT_FORM: `edit-${EDIT_KEYS.FORM_LINK}`,
  ADD_TOPIC: `edit-${EDIT_KEYS.TOPIC}`,
  ADD_GUEST: `edit-${EDIT_KEYS.GUEST}`,
  CANCEL: "cancel-ama",
  CONFIRM: "confirm-ama",

  // Callback actions for broadcast management
  SCHEDULE_BROADCAST: "schedule-broadcast",
  BROADCAST_NOW: "broadcast-now",
  CANCEL_BROADCAST: "cancel-broadcast",
  TOGGLE_SCHEDULE: "toggle-schedule",
  TOGGLE_DISABLED: "toggle-disabled",
  CONFIRM_SCHEDULE: "confirm-schedule",

  // Callback actions for edit confirmation
  EDIT_CONFIRM: "edit-confirm",
  EDIT_CANCEL: "edit-cancel",

  // Callback actions for AMA session management
  START_AMA: "start-ama",
  END_AMA: "end-ama",

  // Callback actions for winner selection
  SELECT_WINNERS: "select-winners",
  SELECT_WINNERS_CMD: "select-winners-cmd",
  FORCE_SELECT_WINNERS: "force-select-winners",
  DISCARD_WINNER: "discard-winner",
  RESET_WINNERS: "reset-winners",
  CONFIRM_WINNERS: "confirm-winners",
  CANCEL_WINNERS: "cancel-winners",
  BROADCAST_WINNERS: "broadcast-winners",
  SCHEDULE_WINNERS_BROADCAST: "schedule-winners-broadcast",

  // Callback actions for claiming rewards
  CLAIM_REWARD: "claim-reward",
};

export const AMA_DEFAULT_DATA = {
  date: dayjs().add(1, "day").format("YYYY-MM-DD"), // one day from now
  time: "20:00:00", // Example: "08:00pm KSA"
  total_pool: "100 USDC",
  reward: "20 USDC",
  winner_count: 5,
  form_link: "https://www.binance.com/en/survey/b2f7b345f34a45eebbe2a77e35604835",
};
