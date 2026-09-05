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
      }
      res.json({
        authenticated: true,
        role: 'coordinador',
      });
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
