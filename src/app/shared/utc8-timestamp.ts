export function formatUtc8Timestamp(timestamp: string, language: 'zh' | 'en' | 'ja' = 'zh'): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})\+08:00$/);
  if (!match) throw new Error(`Invalid page update timestamp: ${timestamp}`);

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]
      || hour > 23 || minute > 59) {
    throw new Error(`Invalid page update timestamp: ${timestamp}`);
  }

  if (language === 'en') {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${day} ${months[month - 1]} ${yearText} ${hourText}:${minuteText} (UTC+8)`;
  }
  if (language === 'ja') return `${yearText}年${month}月${day}日 ${hourText}:${minuteText}（UTC+8）`;
  return `${yearText} 年 ${month} 月 ${day} 日 ${hourText}:${minuteText}（UTC+8）`;
}
