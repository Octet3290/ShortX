import crypto from 'crypto';

// The Base62 character set: 0-9, a-z, A-Z (10 + 26 + 26 = 62 characters)
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHABET_LENGTH = BASE62_ALPHABET.length;

/**
 * Generates a cryptographically secure random Base62 short-code string.
 * Uses crypto.randomBytes to prevent predictability.
 *
 * @param length - The number of characters for the short code (default: 7)
 * @returns A URL-safe Base62 short code (e.g., 'k8F2xQa')
 */
export const generateShortCode = (length = 7): string => {
  const bytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    // Map each random byte to a character in our alphabet
    const index = bytes[i] % ALPHABET_LENGTH;
    result += BASE62_ALPHABET[index];
  }

  return result;
};
