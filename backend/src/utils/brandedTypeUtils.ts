/**
 * Utilities for handling branded type conversions
 * 
 * These utilities help bridge the gap between different branded type implementations
 * during the migration period.
 */

// Cast between different UserId branded types
export const castUserId = <T>(userId: any): T => {
  return userId as T;
};

// Cast between different SessionId branded types
export const castSessionId = <T>(sessionId: any): T => {
  return sessionId as T;
};

// Cast between different Email branded types
export const castEmail = <T>(email: any): T => {
  return email as T;
};

// Cast between different branded types generically
export const castBrandedType = <T>(value: any): T => {
  return value as T;
};