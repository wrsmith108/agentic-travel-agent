/**
 * Branded types for type-safe domain modeling in the authentication system
 */

// Base brand type helper
type Brand<T, TBrand> = T & { readonly brand: TBrand };

// User-related branded types
export type UserId = Brand<string, 'UserId'>;
export type Email = Brand<string, 'Email'>;
export type HashedPassword = Brand<string, 'HashedPassword'>;
export type PlainPassword = Brand<string, 'PlainPassword'>;
export type SessionId = Brand<string, 'SessionId'>;
export type JWTToken = Brand<string, 'JWTToken'>;
export type RefreshToken = Brand<string, 'RefreshToken'>;
export type ResetToken = Brand<string, 'ResetToken'>;
export type VerificationToken = Brand<string, 'VerificationToken'>;
export type DeviceFingerprint = Brand<string, 'DeviceFingerprint'>;
export type IpAddress = Brand<string, 'IpAddress'>;
export type IPAddress = IpAddress; // Alias for compatibility
export type UserAgent = Brand<string, 'UserAgent'>;
export type RequestId = Brand<string, 'RequestId'>;
export type AccessToken = Brand<string, 'AccessToken'>;
export type AuthToken = Brand<string, 'AuthToken'>;
export type PasswordResetToken = Brand<string, 'PasswordResetToken'>;
export type EmailVerificationToken = Brand<string, 'EmailVerificationToken'>;

// File system types
export type FilePath = Brand<string, 'FilePath'>;

// Conversation types
export type ConversationId = Brand<string, 'ConversationId'>;
export type MessageId = Brand<string, 'MessageId'>;

// Time-related branded types
export type Timestamp = Brand<string, 'Timestamp'>;
export type Duration = Brand<number, 'Duration'>; // in seconds

// Constructor functions for branded types
export const UserId = (value: string): UserId => value as UserId;
export const Email = (value: string): Email => value.toLowerCase().trim() as Email;
export const HashedPassword = (value: string): HashedPassword => value as HashedPassword;
export const PlainPassword = (value: string): PlainPassword => value as PlainPassword;
export const SessionId = (value: string): SessionId => value as SessionId;
export const JWTToken = (value: string): JWTToken => value as JWTToken;
export const RefreshToken = (value: string): RefreshToken => value as RefreshToken;
export const ResetToken = (value: string): ResetToken => value as ResetToken;
export const VerificationToken = (value: string): VerificationToken => value as VerificationToken;
export const DeviceFingerprint = (value: string): DeviceFingerprint => value as DeviceFingerprint;
export const IpAddress = (value: string): IpAddress => value as IpAddress;
export const UserAgent = (value: string): UserAgent => value as UserAgent;
export const RequestId = (value: string): RequestId => value as RequestId;
export const AccessToken = (value: string): AccessToken => value as AccessToken;
export const AuthToken = (value: string): AuthToken => value as AuthToken;
export const PasswordResetToken = (value: string): PasswordResetToken => value as PasswordResetToken;
export const EmailVerificationToken = (value: string): EmailVerificationToken => value as EmailVerificationToken;
export const FilePath = (value: string): FilePath => value as FilePath;
export const ConversationId = (value: string): ConversationId => value as ConversationId;
export const MessageId = (value: string): MessageId => value as MessageId;
export const Timestamp = (value: string): Timestamp => value as Timestamp;
export const Duration = (value: number): Duration => value as Duration;
export const IPAddress = IpAddress; // Alias for compatibility

// Type guards
export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && value.length > 0;

export const isEmail = (value: unknown): value is Email =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isSessionId = (value: unknown): value is SessionId =>
  typeof value === 'string' && value.length > 0;

export const isJWTToken = (value: unknown): value is JWTToken =>
  typeof value === 'string' && value.split('.').length === 3;

export const isTimestamp = (value: unknown): value is Timestamp =>
  typeof value === 'string' && !isNaN(Date.parse(value));

export const isDuration = (value: unknown): value is Duration =>
  typeof value === 'number' && value >= 0;
