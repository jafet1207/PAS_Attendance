import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config/env.js';
import { getPool } from './db/index.js';
import { AuthController } from './controllers/authController.js';
import { GroupsController } from './controllers/groupsController.js';
import { ServicesController } from './controllers/servicesController.js';
import { ParticipantsController } from './controllers/participantsController.js';
import { ConfirmController } from './controllers/confirmController.js';
import { RemindersController } from './controllers/remindersController.js';
import { requireAuth, requireReminderAuth } from './middlewares/auth.js';

export function createApp(): express.Express {
  const app = express();

  // Necesario en Vercel (y cualquier proxy que termine TLS antes de la función): sin esto,
  // Express ve la conexión interna como HTTP plano y express-session, al tener
  // cookie.secure=true en producción, omite el Set-Cookie por considerarla insegura.
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        // DM-6: en despliegue (Vercel) frontend y backend viven bajo el mismo dominio, así
        // que en producción normalmente no hace falta ningún origen adicional acá; esta
        // variable solo importa si el frontend llega a servirse desde un dominio distinto.
        ...(config.frontendOrigin ? [config.frontendOrigin] : []),
      ],
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // DM-7: la sesión del coordinador se guarda en Postgres (connect-pg-simple), no en memoria
  // del proceso. En un entorno serverless cada invocación es una instancia aislada y efímera;
  // el MemoryStore por defecto de express-session no sobrevive entre invocaciones ni se
  // comparte entre instancias concurrentes.
  const PgSessionStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgSessionStore({
        pool: getPool(),
        tableName: 'session',
        createTableIfMissing: false, // la tabla ya la crea initDb(), ver db/index.ts
        pruneSessionInterval: false, // sin temporizador recurrente: no aplica en serverless
      }),
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

  // Automatización de recordatorios (Etapa 5, sesión de coordinador o Bearer CRON_SECRET)
  app.get('/api/enviar-recordatorios', requireReminderAuth, RemindersController.triggerReminders);
  app.post('/api/enviar-recordatorios', requireReminderAuth, RemindersController.triggerReminders);

  return app;
}
