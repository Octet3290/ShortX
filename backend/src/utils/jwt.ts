import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface UserPayload {
  userId: string;
  email: string;
}

/**
 * Signs a new JWT for an authenticated user.
 */
export const signToken = (payload: UserPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Verifies a JWT and extracts the user payload.
 * Throws an error if the token is invalid or expired.
 */
export const verifyToken = (token: string): UserPayload => {
  return jwt.verify(token, env.JWT_SECRET) as UserPayload;
};
