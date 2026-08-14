import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'farmacia_session';

export interface SessionData {
  userId: number;
  login: string;
  nome: string;
  papel: 'admin' | 'funcionario';
}

function getSecret(): string {
  return process.env.APP_PASSWORD_HASH_SECRET || 'dev-secret-troque-em-producao';
}

export function createSessionToken(data: SessionData): string {
  const payloadJson = JSON.stringify(data);
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

function verifyToken(token: string): SessionData | null {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');
    if (sig !== expectedSig) return null;
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    return JSON.parse(payloadJson) as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
