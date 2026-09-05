import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

declare module 'express-session' {
  interface SessionData {
    coordinador_autenticado?: boolean;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.coordinador_autenticado) {
    next();
    return;
  }
  res.status(401).json({ error: 'No autorizado' });
}

export function requireReminderAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.coordinador_autenticado) {
    next();
    return;
  }

  if (config.cronSecret) {
    const authHeader = req.headers.authorization || '';
    if (authHeader === `Bearer ${config.cronSecret}`) {
      next();
      return;
    }
  }

  res.status(401).json({ error: 'No autorizado' });
}
