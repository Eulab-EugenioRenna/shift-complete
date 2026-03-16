import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) {
    return false;
  }

  const currentHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  const originalBuffer = Buffer.from(originalHash, 'hex');

  if (currentHash.length !== originalBuffer.length) {
    return false;
  }

  return timingSafeEqual(currentHash, originalBuffer);
}
