import { AMA_HASHTAGS } from "../../ama.constants";
import { TIMEZONES } from "../../helper/date-utils";
import { SupportedLanguage } from "../../types";

interface AMAData {
  session_no: number;
  language: SupportedLanguage;
  datetime: Date;
  total_pool: string;
  reward: string;
  winner_count: number;
  form_link: string;
  banner_file_id?: string;
}

/**
 * Builds an HTML-formatted AMA message
 */
export function buildAMAMessage(data: AMAData): string {
  // UTC to KSA conversion
  const locale = data.language === "ar" ? "ar-SA" : "en-US";

  const formattedDate = data.datetime?.toLocaleString(locale, {
    timeZone: TIMEZONES.KSA,
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  const formattedTime = data.datetime?.toLocaleString(locale, {
    timeZone: TIMEZONES.KSA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (data.language === "ar") {
    return `<b>📣 انضموا إلينا في جلسة اسألني أي شيء ضمن سلسلة جلسات بينانس الأسبوعية مع فريق #بينانس في منطقة الشرق الأوسط وشمال إفريقيا، واحصلوا على فرصة للفوز بجزء من مجمّع الجوائز البالغ ${data.total_pool}!</b> 🎁

⬅️ سيتم توزيع الجوائز على ${data.winner_count} فائزين، يحصل كل منهم على ${data.reward}.

🗓 ${formattedDate}، الساعة ${formattedTime} KSA
📍 <a href="https://t.me/${process.env.AR_PUBLIC_GROUP_USERNAME}?videochat">https://t.me/${process.env.AR_PUBLIC_GROUP_USERNAME}?videochat</a>

<b>⚡️للتأهل للفوز، يجب:</b>
1️⃣ يرجى ملء هذه <a href="${data.form_link}">الاستمارة</a> لتكون مؤهلاً.
2️⃣ المشاركة في المحادثة الصوتية.
3️⃣ طرح سؤال أثناء الجلسة باستخدام الهاشتاج <b>#${AMA_HASHTAGS["ar"]}${data.session_no}</b>
4️⃣ أن يكون لديك اسم مستخدم على تيليجرام.
5️⃣ ألا تكون من الفائزين في مسابقات جلسات بينانس خلال آخر 30 يومًا.

⛔ تحتفظ بينانس بحق استبعاد أي مشارك يظهر سلوكًا احتياليًا. <a href="https://www.binance.com/en/pp-terms">تطبق الشروط والأحكام</a>

‼️ سيتم الإعلان عن الفائزين وتوزيع الجوائز خلال أسبوعين بعد الجلسة.

♥️ يسعدنا مشاركتكم معنا!`;
  } else {
    // Default (English)
    return `<b>📣 Join us for an AMA from our Binance Weekly Sessions with the #BinanceMENA team and get the chance to win a share of the ${data.total_pool} reward pool!</b> 🎁

➡️ The reward pool will be shared among ${data.winner_count} winners, each receiving ${data.reward}.

🗓 ${formattedDate} at ${formattedTime} KSA
📍 <a href="https://t.me/${process.env.EN_PUBLIC_GROUP_USERNAME}?videochat">https://t.me/${process.env.EN_PUBLIC_GROUP_USERNAME}?videochat</a>

<b>⚡️To be eligible to win, you must:</b>
1️⃣ Please fill out <a href="${data.form_link}">this form</a> to qualify for the reward.
2️⃣ Join and participate in the voice chat.
3️⃣ Ask a question using the hashtag <b>#${AMA_HASHTAGS["en"]}${data.session_no}</b> during the session.
4️⃣ Have a valid Telegram username.
5️⃣ Not have won a Binance Weekly AMA reward in the last 30 days.

⛔ Binance reserves the right to disqualify any participant showing signs of fraudulent activity. <a href="https://www.binance.com/en/pp-terms">Terms apply</a>

‼️ Winners will be announced, and prizes distributed within two weeks after the event.

♥️ We’re excited to have you with us!`;
  }
}

export const imageUrl =
  "https://ff695b5dd2960f41cb75835a324f0804.r2.cloudflarestorage.com/drp-cl/373f7ca1-1d4d-4e78-ba4c-ce82a6a6871d/67ce832b-0763-4b97-8918-37fc7be2578a/db00a674-7bad-4c57-8c19-9554f9a67ddd.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=fed7aac277aea51eca0c294ada409f61%2F20250618%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250618T060217Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=168745b090115af8c2df507c4e318781c0ce4f3ad2cb7dea12dbc7eb50263329";
