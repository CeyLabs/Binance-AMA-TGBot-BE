import { Markup } from "telegraf";
import { CALLBACK_ACTIONS } from "../../ama.constants";
import { InlineKeyboardMarkup } from "telegraf/typings/core/types/typegram";
import { UUID } from "crypto";

export const NewAMAKeyboard = (id: UUID): InlineKeyboardMarkup => {
  // prettier-ignore
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Edit Date", `${CALLBACK_ACTIONS.EDIT_DATE}_${id}`),
      Markup.button.callback("Edit Time", `${CALLBACK_ACTIONS.EDIT_TIME}_${id}`),
    ],
    [
      Markup.button.callback("Edit Session Number", `${CALLBACK_ACTIONS.EDIT_SESSION}_${id}`),
      Markup.button.callback("Edit Reward Prize", `${CALLBACK_ACTIONS.EDIT_REWARD}_${id}`),
    ],
    [
      Markup.button.callback("Edit Winner Count", `${CALLBACK_ACTIONS.EDIT_WINNERS}_${id}`),
      Markup.button.callback("Edit Total Pool", `${CALLBACK_ACTIONS.EDIT_TOTAL_POOL}_${id}`),
    ],
    [
      Markup.button.callback("Edit Form Link", `${CALLBACK_ACTIONS.EDIT_FORM}_${id}`),
      Markup.button.callback("Add Topic", `${CALLBACK_ACTIONS.ADD_TOPIC}_${id}`),
    ],
    [
      Markup.button.callback("Add Special Guest", `${CALLBACK_ACTIONS.ADD_GUEST}_${id}`),
      Markup.button.callback("Edit Banner", `${CALLBACK_ACTIONS.EDIT_BANNER}_${id}`),
    ],
    [
      Markup.button.callback("Cancel", `${CALLBACK_ACTIONS.CANCEL}_${id}`),
      Markup.button.callback("✅ Confirm", `${CALLBACK_ACTIONS.CONFIRM}_${id}`),
    ],
  ]).reply_markup;
};
