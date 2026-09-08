import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde .env si existe (probando en backend o raíz)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  testDatabaseUrl: process.env.TEST_DATABASE_URL || '',
  secretKey: process.env.SECRET_KEY || 'clave-secreta-por-defecto-pas-attendance',
  cronSecret: process.env.CRON_SECRET || 'cron-secret-por-defecto-pas-attendance',
  coordinadorPassword: process.env.COORDINADOR_PASSWORD || 'coordinador123',
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
  frontendOrigin: process.env.FRONTEND_ORIGIN || '',
  diasCierreRegular: parseInt(process.env.DIAS_CIERRE_REGULAR || '3', 10),
  diasCierreExtraordinario: parseInt(process.env.DIAS_CIERRE_EXTRAORDINARIO || '1', 10),
};

// Constantes de negocio
export const BUSINESS_CONSTANTS = {
  MAX_RECORDATORIOS_EXITOSOS: 3,
  // RN-7 (revisada): un recordatorio solo se envía cuando faltan exactamente 2 días, 1 día, o
  // es el mismo día del cierre de confirmación (el día de cierre sigue abierto hasta medianoche).
  DIAS_DE_ENVIO_RECORDATORIO: [2, 1, 0] as readonly number[],
  ZONA_HORARIA_OFFSET_HORAS: -6, // Costa Rica UTC-6
  BUFFER_LLEGADA_HORAS: {
    Servidor: 1.5,
    Inducción: 2.0,
  } as Record<string, number>,
  GRUPOS_SIN_RECORDATORIOS: ['Líder', 'Director'] as readonly string[],
  DURACION_EXTRA_HORAS: 2,
  TOKEN_MAX_AGE_SEGUNDOS: 7 * 24 * 3600, // 7 días
  GRUPOS_BASE: ['Servidor', 'Inducción', 'Líder', 'Director'] as const,
  // RN-19: catálogo semilla de Áreas y sus puestos de tipo Principal. "Coordinador de área (<Área>)"
  // es un puesto más de la lista (sin tratamiento especial), presente en todas las Áreas salvo Kids.
  AREAS_Y_PUESTOS_BASE: [
    { area: 'Parqueo', puestos: ['Coordinador de área (Parqueo)', 'Parqueo'] },
    {
      area: 'Auditorio',
      puestos: [
        'Coordinador de área (Auditorio)',
        'Sala KZN Babies',
        'Entrada al auditorio (Puertas de madera) - Lado Kids',
        'Entrada al auditorio (Puertas de madera) - Lado Cafetería',
        'Auditorio - Adentro',
      ],
    },
    {
      area: 'Lobby y Pasillos',
      puestos: [
        'Coordinador de área (Lobby y Pasillos)',
        'Puertas principales - Frente',
        'Entrada al edificio (Puertas de vidrio) - Lado Kids',
        'Entrada al edificio (Puertas de vidrio) - Lado Cafetería',
        'Cafetería',
        'Cafetería - Info PAS',
        'Click - Lobby principal',
        'Click - Lado Kids',
        'Click - Lado Cafetería',
      ],
    },
    { area: 'Quiero orar por vos', puestos: ['Coordinador de área (Quiero orar por vos)', 'Quiero orar por vos'] },
    { area: 'Kids', puestos: ['Kids'] },
  ] as const,
  // RN-19: puestos de tipo Secundario, sin Área.
  PUESTOS_SECUNDARIOS_BASE: ['Café', 'Apertura Puertas', 'Apoyo Logística'] as const,
};
