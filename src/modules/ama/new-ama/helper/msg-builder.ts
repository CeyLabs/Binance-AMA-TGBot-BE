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
📍 <a href="https://t.me/${process.env.AR_PUBLIC_GROUP_USERNAME}?videochat">انضم إلى الدردشة الصوتية</a>

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
📍 <a href="https://t.me/${process.env.EN_PUBLIC_GROUP_USERNAME}?videochat">Join Voice Chat</a>

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

export const initImageUrl = {
  en: "https://a.dropoverapp.com/cloud/download/4b887302-d2ec-41c1-833d-ef13fae61c7d/0d04b604-be47-4a84-a83c-b40424f78034",
  ar: "https://a.dropoverapp.com/cloud/download/65c74651-2979-4986-a0aa-4f2025a07300/7da5d361-ad30-44be-a636-5430c7f57c01"
}