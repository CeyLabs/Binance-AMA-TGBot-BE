export const AMA_COMMANDS = {
  NEW: "newama",
  END: "endama",
};

export const AMA_HASHTAG = "BinanceWeeklySessions";

export const CALLBACK_ACTIONS = {
  // Callback actions for AMA management
  EDIT_DATE: "edit-date",
  EDIT_TIME: "edit-time",
  EDIT_SESSION: "edit-session",
  EDIT_REWARD: "edit-reward",
  EDIT_WINNERS: "edit-winners",
  EDIT_FORM: "edit-form",
  ADD_TOPIC: "add-topic",
  ADD_GUEST: "add-guest",
  CANCEL: "cancel-ama",
  CONFIRM: "confirm-ama",

  // Callback actions for broadcast management
  SCHEDULE_BROADCAST: "schedule-broadcast",
  BROADCAST_NOW: "broadcast-now",
  CANCEL_BROADCAST: "cancel-broadcast",
};

export const AMA_DEFAULT_DATA = {
  date: new Date(),
  // time should be in proper time format to put in knex database
  // Example: "08:00pm KSA"
  time: "20:00:00",
  total_pool: "100 FDUSD",
  reward: "33.3 FDUSD",
  winner_count: 3,
  form_link: "https://example.com/form",
};
