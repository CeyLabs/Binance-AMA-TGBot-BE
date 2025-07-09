import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const TIMEZONES = {
  KSA: `Asia/Riyadh`,
};

export const DATETIME_REGEX = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/;
const TIME_REGEX = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;

/**
 * Converts a KSA datetime to UTC.
 * @param date - The date string or Date object in KSA timezone (e.g., "2025-07-04")
 * @param time - The time string in KSA timezone (e.g., "20:00:00")
 * @returns The datetime in UTC
 */
export function convertDateTimeToUTC(date: string | Date, time: string): dayjs.Dayjs {
  // Format date to YYYY-MM-DD if it's a Date object
  let formattedDate: string;

  if (date instanceof Date) {
    formattedDate = dayjs(date).format("YYYY-MM-DD");
  } else if (typeof date === "string") {
    formattedDate = date;
  } else {
    formattedDate = dayjs(date).format("YYYY-MM-DD");
  }

  // Ensure time is in proper format (HH:mm:ss)
  const timeMatch = time.match(TIME_REGEX);

  let formattedTime = time;
  if (timeMatch) {
    const hour = timeMatch[1].padStart(2, "0");
    const minute = timeMatch[2].padStart(2, "0");
    const second = (timeMatch[3] || "0").padStart(2, "0");
    formattedTime = `${hour}:${minute}:${second}`;
  }

  const ksaDatetime = `${formattedDate}T${formattedTime}`;

  // Validate the datetime
  if (!dayjs(ksaDatetime).isValid()) {
    const originalDateValue = date instanceof Date ? date.toString() : date;
    throw new Error(
      `Invalid datetime format: ${originalDateValue}T${time} (formatted as ${ksaDatetime})`,
    );
  }

  return dayjs.tz(ksaDatetime, TIMEZONES.KSA).utc();
}
