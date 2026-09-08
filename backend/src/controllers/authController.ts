import { Request, Response } from 'express';
import { config } from '../config/env.js';

export class AuthController {
  static getSession(req: Request, res: Response): void {
    const authenticated = Boolean(req.session && req.session.coordinador_autenticado);
    res.json({
      authenticated,
      role: authenticated ? 'coordinador' : null,
    });
  }

  static login(req: Request, res: Response): void {
    const { password } = req.body || {};

    if (password && password === config.coordinadorPassword) {
      if (req.session) {
        req.session.coordinador_autenticado = true;
        // Esperar el guardado antes de responder: en serverless (Vercel) la función puede
        // congelarse apenas se envía la respuesta, y el guardado en Postgres es asíncrono
        // (connect-pg-simple, DM-7) — sin esto, la cookie de sesión podía perderse.
        req.session.save((err) => {
          if (err) {
            console.error('[Session Login Error]', err);
            res.status(500).json({ error: 'Error al iniciar sesión.' });
            return;
          }
          res.json({ authenticated: true, role: 'coordinador' });
        });
        return;
      }
      res.json({ authenticated: true, role: 'coordinador' });
      return;
    }

    res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  static logout(req: Request, res: Response): void {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[Session Logout Error]', err);
        }
        res.clearCookie('connect.sid');
        res.json({ authenticated: false });
      });
      return;
    }
    res.json({ authenticated: false });
  }
}
