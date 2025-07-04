import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const KSA_TIMEZONE = "Asia/Riyadh";

/**
 * Converts a KSA datetime to UTC.
 * @param date - The date string or Date object in KSA timezone (e.g., "2025-07-04")
 * @param time - The time string in KSA timezone (e.g., "20:00:00")
 * @returns The datetime in UTC
 */
export function convertDateTimeToUTC(date: string | Date, time: string): dayjs.Dayjs {
  // Format date to YYYY-MM-DD if it's a Date object
  const formattedDate =
    date instanceof Date
      ? dayjs(date).format("YYYY-MM-DD")
      : typeof date === "string"
        ? date
        : dayjs(date).format("YYYY-MM-DD");

  // Ensure time is in proper format (HH:mm:ss)
  const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
  const timeMatch = time.match(timeRegex);

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

  return dayjs.tz(ksaDatetime, KSA_TIMEZONE).utc();
}

/**
 * Converts a KSA date to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04")
 * @param originalTime - The original time string to use for conversion (optional)
 * @returns The date in UTC
 */
export function convertDateToUTC(date: string, originalTime?: string): string {
  const timeToUse = originalTime || "00:00:00";
  return convertDateTimeToUTC(date, timeToUse).format("YYYY-MM-DD");
}

/**
 * Converts a KSA time to UTC.
 * @param time - The time string in KSA timezone (e.g., "20:00:00")
 * @param originalDate - The original date string or Date object to use for conversion (optional)
 * @returns The time in UTC
 */
export function convertTimeToUTC(time: string, originalDate?: string | Date): string {
  // Handle Date object by converting to YYYY-MM-DD format
  let dateToUse: string;

  if (originalDate) {
    if (originalDate instanceof Date || typeof originalDate === "object") {
      // If it's a Date object or something that needs formatting
      dateToUse = dayjs(originalDate).format("YYYY-MM-DD");
    } else {
      // If it's already a string
      dateToUse = originalDate;
    }
  } else {
    // Default to today
    dateToUse = dayjs().format("YYYY-MM-DD");
  }

  return convertDateTimeToUTC(dateToUse, time).format("HH:mm:ss");
}

/**
 * Converts a date and time from KSA timezone to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04").
 * @param time - The time string in KSA timezone (e.g., "20:00:00").
 * @returns An object containing the converted date and time in UTC.
 */
export function convertToUTC(date: string, time: string): { dateUTC: string; timeUTC: string } {
  // Create a KSA datetime string and parse it in KSA timezone
  const ksaDatetime = `${date}T${time}`;

  // Parse in KSA timezone and convert to UTC
  const utcDateTime = dayjs.tz(ksaDatetime, KSA_TIMEZONE).utc();

  const result = {
    dateUTC: utcDateTime.format("YYYY-MM-DD"),
    timeUTC: utcDateTime.format("HH:mm:ss"),
  };

  return result;
}

/**
 * Converts UTC date and time back to KSA timezone
 * @param date - The date string in UTC (YYYY-MM-DD)
 * @param time - The time string in UTC (HH:mm:ss)
 * @returns The datetime in KSA timezone
 */
export function convertUTCToKSA(date: string, time: string): { ksaDate: string; ksaTime: string } {
  // Create a UTC datetime string and parse it as UTC
  const utcDatetime = `${date}T${time}`;
  // Explicitly parse as UTC first
  const utcMoment = dayjs.utc(utcDatetime);
  // Convert to KSA timezone
  const ksaDateTime = utcMoment.tz(KSA_TIMEZONE);
  const result = {
    ksaDate: ksaDateTime.format("YYYY-MM-DD"),
    ksaTime: ksaDateTime.format("HH:mm:ss"),
  };

  return result;
}
