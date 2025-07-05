export type JWTConfig = {
  accessSecret: string;
  refreshSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
};

export type TokenPayload = {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  jti?: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type JWTError = {
  code: 'INVALID_TOKEN' | 'TOKEN_BLACKLISTED' | 'INVALID_REFRESH_TOKEN' | 
        'REFRESH_TOKEN_NOT_FOUND' | 'TOKEN_GENERATION_FAILED' | 'REDIS_ERROR';
  message: string;
};