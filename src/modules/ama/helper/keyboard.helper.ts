import { Markup } from "telegraf";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { InlineKeyboardMarkup } from "telegraf/typings/core/types/typegram";

export const NewAMAKeyboard = (sessionNo: number): InlineKeyboardMarkup => {
  // prettier-ignore
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Edit Date", `${CALLBACK_ACTIONS.EDIT_DATE}_${sessionNo}`),
      Markup.button.callback("Edit Time", `${CALLBACK_ACTIONS.EDIT_TIME}_${sessionNo}`),
    ],
    [
      Markup.button.callback("Edit Session Number", `${CALLBACK_ACTIONS.EDIT_SESSION}_${sessionNo}`),
      Markup.button.callback("Edit Reward Prize", `${CALLBACK_ACTIONS.EDIT_REWARD}_${sessionNo}`),
    ],
    [
      Markup.button.callback("Edit Winner Count", `${CALLBACK_ACTIONS.EDIT_WINNERS}_${sessionNo}`),
      Markup.button.callback("Edit Form Link", `${CALLBACK_ACTIONS.EDIT_FORM}_${sessionNo}`),
    ],
    [
      Markup.button.callback("Add Topic", `${CALLBACK_ACTIONS.ADD_TOPIC}_${sessionNo}`),
      Markup.button.callback("Add Special Guest", `${CALLBACK_ACTIONS.ADD_GUEST}_${sessionNo}`),
    ],
    [
      Markup.button.callback("Cancel", `${CALLBACK_ACTIONS.CANCEL}_${sessionNo}`),
      Markup.button.callback("✅ Confirm", `${CALLBACK_ACTIONS.CONFIRM}_${sessionNo}`),
    ],
  ]).reply_markup;
};
