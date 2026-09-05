import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { config } from './config/env.js';
import { AuthController } from './controllers/authController.js';

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
      ],
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: config.secretKey,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 7 * 24 * 3600 * 1000, // 7 días
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
      },
    })
  );

  // Rutas de autenticación y sesión (Etapa 1)
  app.get('/api/session', AuthController.getSession);
  app.post('/api/login', AuthController.login);
  app.post('/api/logout', AuthController.logout);

  return app;
}
