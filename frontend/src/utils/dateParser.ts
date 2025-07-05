/**
 * Parse natural language dates to YYYY-MM-DD format
 */
export function parseDateToISO(dateStr: string): string {
  const today = new Date();
  const normalizedStr = dateStr.toLowerCase().trim();
  
  // Handle relative dates
  if (normalizedStr === 'today') {
    return formatDate(today);
  }
  
  if (normalizedStr === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  
  if (normalizedStr === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }
  
  // Handle "next [day]" pattern
  const nextDayMatch = normalizedStr.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextDayMatch && nextDayMatch[1]) {
    const targetDay = nextDayMatch[1];
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayIndex = daysOfWeek.indexOf(targetDay);
    
    const nextDate = new Date(today);
    const currentDayIndex = today.getDay();
    
    let daysToAdd = targetDayIndex - currentDayIndex;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return formatDate(nextDate);
  }
  
  // Try to parse various date formats
  try {
    // Handle MM/DD/YYYY or MM-DD-YYYY
    const slashDateMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashDateMatch && slashDateMatch[1] && slashDateMatch[2] && slashDateMatch[3]) {
      const month = slashDateMatch[1].padStart(2, '0');
      const day = slashDateMatch[2].padStart(2, '0');
      const year = slashDateMatch[3];
      return `${year}-${month}-${day}`;
    }
    
    // Handle "Month DD" or "Month DDth" (assumes current or next year)
    const monthDayMatch = dateStr.match(/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
    if (monthDayMatch && monthDayMatch[1] && monthDayMatch[2]) {
      const monthStr = monthDayMatch[1];
      const day = monthDayMatch[2];
      
      const monthNames: { [key: string]: number } = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8, 'sept': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
      };
      
      const month = monthNames[monthStr.toLowerCase()];
      if (month === undefined) {
        return dateStr; // Invalid month name - return original string
      }
      const parsedDate = new Date(today.getFullYear(), month, parseInt(day));
      
      // If the date is in the past, assume next year
      if (parsedDate < today) {
        parsedDate.setFullYear(parsedDate.getFullYear() + 1);
      }
      
      return formatDate(parsedDate);
    }
    
    // Try parsing with Date constructor as last resort
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  } catch (e) {
    // If parsing fails, return the original string
  }
  
  // Return original string if we can't parse it
  return dateStr;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}