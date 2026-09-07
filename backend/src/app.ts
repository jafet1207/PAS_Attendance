import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { config } from './config/env.js';
import { AuthController } from './controllers/authController.js';
import { GroupsController } from './controllers/groupsController.js';
import { ServicesController } from './controllers/servicesController.js';
import { ParticipantsController } from './controllers/participantsController.js';
import { ConfirmController } from './controllers/confirmController.js';
import { requireAuth } from './middlewares/auth.js';

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

  // Rutas de grupos y servicios (Etapa 2, protegidas)
  app.get('/api/groups', requireAuth, GroupsController.getGroups);
  app.get('/api/services/config', requireAuth, ServicesController.getConfig);
  app.get('/api/services', requireAuth, ServicesController.getServices);
  app.post('/api/services', requireAuth, ServicesController.createService);
  app.get('/api/services/:id', requireAuth, ServicesController.getServiceDetail);
  app.get('/api/services/:id/submissions', requireAuth, ServicesController.getServiceSubmissions);

  // Rutas de servidores / participantes (Etapa 3, protegidas)
  app.get('/api/participants', requireAuth, ParticipantsController.getParticipants);
  app.post('/api/participants', requireAuth, ParticipantsController.createParticipant);
  app.patch('/api/participants/:id/role', requireAuth, ParticipantsController.updateParticipantRole);
  app.patch('/api/participants/:id/email', requireAuth, ParticipantsController.updateParticipantEmail);
  app.patch('/api/participants/:id/status', requireAuth, ParticipantsController.updateParticipantStatus);

  // Ruta pública / legacy de servicios
  app.get('/api/servicios', ServicesController.getServiciosLegacy);

  // Rutas públicas de confirmación por enlace (Etapa 4)
  app.get('/confirm/:token', ConfirmController.getForm);
  app.post('/confirm/:token', ConfirmController.submitForm);
  app.get('/confirm/:token/:accion', ConfirmController.quickAction);

  return app;
}
