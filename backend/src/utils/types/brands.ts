// Brand types to prevent primitive type confusion
export type UserId = string & { __brand: 'UserId' };
export type Email = string & { __brand: 'Email' };
export type SessionId = string & { __brand: 'SessionId' };
export type ISODateString = string & { __brand: 'ISODate' };
export type UnixTimestamp = number & { __brand: 'UnixTime' };
export type Money = number & { __brand: 'Money' };
export type FlightId = string & { __brand: 'FlightId' };
export type BookingId = string & { __brand: 'BookingId' };

// Factory functions for creating branded types
export const userId = (id: string): UserId => id as UserId;
export const email = (str: string): Email => str as Email;
export const sessionId = (id: string): SessionId => id as SessionId;
export const isoDate = (date: Date | string): ISODateString => {
  if (typeof date === 'string') return date as ISODateString;
  return date.toISOString() as ISODateString;
};
export const unixTime = (ms: number): UnixTimestamp => ms as UnixTimestamp;
export const money = (amount: number): Money => amount as Money;
export const flightId = (id: string): FlightId => id as FlightId;
export const bookingId = (id: string): BookingId => id as BookingId;

// Type guards for branded types
export const isUserId = (value: unknown): value is UserId => {
  return typeof value === 'string' && value.length > 0;
};

export const isEmail = (value: unknown): value is Email => {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const isSessionId = (value: unknown): value is SessionId => {
  return typeof value === 'string' && value.length > 0;
};

export const isISODateString = (value: unknown): value is ISODateString => {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
};

export const isUnixTimestamp = (value: unknown): value is UnixTimestamp => {
  return typeof value === 'number' && value > 0;
};

export const isMoney = (value: unknown): value is Money => {
  return typeof value === 'number' && value >= 0 && Number.isFinite(value);
};