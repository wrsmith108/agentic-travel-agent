import { ISODateString, UnixTimestamp } from './brands';

export const dateUtils = {
  // Core conversions
  toISO: (date: Date): ISODateString => date.toISOString() as ISODateString,
  fromISO: (iso: ISODateString): Date => new Date(iso),
  toUnix: (date: Date): UnixTimestamp => date.getTime() as UnixTimestamp,
  fromUnix: (unix: UnixTimestamp): Date => new Date(unix),
  
  // Safe conversions with null handling
  ensureISO: (value: Date | string | null | undefined): ISODateString | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      // Validate it's a proper ISO string
      const date = new Date(value);
      if (isNaN(date.getTime())) return undefined;
      return value as ISODateString;
    }
    return value.toISOString() as ISODateString;
  },
  
  ensureDate: (value: Date | string | null | undefined): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  },
  
  // Comparison utilities
  isBefore: (date1: Date | ISODateString, date2: Date | ISODateString): boolean => {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    return d1 < d2;
  },
  
  isAfter: (date1: Date | ISODateString, date2: Date | ISODateString): boolean => {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    return d1 > d2;
  },
  
  isSameDay: (date1: Date | ISODateString, date2: Date | ISODateString): boolean => {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  },
  
  // Formatting utilities
  toDateOnly: (date: Date | ISODateString): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  },
  
  // Validation
  isValidDate: (value: unknown): boolean => {
    if (!value) return false;
    const date = new Date(value as any);
    return !isNaN(date.getTime());
  },
  
  // Common operations
  addDays: (date: Date | ISODateString, days: number): ISODateString => {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString() as ISODateString;
  },
  
  addHours: (date: Date | ISODateString, hours: number): ISODateString => {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setHours(d.getHours() + hours);
    return d.toISOString() as ISODateString;
  },
  
  // Get current time in different formats
  now: (): ISODateString => new Date().toISOString() as ISODateString,
  nowUnix: (): UnixTimestamp => Date.now() as UnixTimestamp,
  nowDate: (): Date => new Date(),
  
  // Parse various date formats
  parse: (value: string | number | Date): Date | undefined => {
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }
};

// Type guard for date-like values
export function isDateLike(value: unknown): value is Date | string | number {
  if (value instanceof Date) return true;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}