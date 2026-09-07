import jwt from 'jsonwebtoken';
import { config, BUSINESS_CONSTANTS } from '../config/env.js';

export interface TokenPayload {
  p: number; // participante_id
  s: number; // servicio_id
}

export function generarToken(participanteId: number, servicioId: number): string {
  const payload: TokenPayload = { p: participanteId, s: servicioId };
  return jwt.sign(payload, config.secretKey, {
    expiresIn: BUSINESS_CONSTANTS.TOKEN_MAX_AGE_SEGUNDOS,
  });
}

export function decodificarToken(
  token: string
): { participanteId: number | null; servicioId: number | null } {
  try {
    const decoded = jwt.verify(token, config.secretKey) as TokenPayload;
    if (typeof decoded.p === 'number' && typeof decoded.s === 'number') {
      return { participanteId: decoded.p, servicioId: decoded.s };
    }
    return { participanteId: null, servicioId: null };
  } catch (error) {
    return { participanteId: null, servicioId: null };
  }
}
