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
  diasCierreRegular: parseInt(process.env.DIAS_CIERRE_REGULAR || '3', 10),
  diasCierreExtraordinario: parseInt(process.env.DIAS_CIERRE_EXTRAORDINARIO || '1', 10),
};

// Constantes de negocio
export const BUSINESS_CONSTANTS = {
  MAX_RECORDATORIOS_EXITOSOS: 3,
  ZONA_HORARIA_OFFSET_HORAS: -6, // Costa Rica UTC-6
  BUFFER_LLEGADA_HORAS: {
    Servidor: 1.5,
    Inducción: 2.0,
  } as Record<string, number>,
  GRUPOS_SIN_RECORDATORIOS: ['Líder', 'Director'] as readonly string[],
  DURACION_EXTRA_HORAS: 2,
  TOKEN_MAX_AGE_SEGUNDOS: 7 * 24 * 3600, // 7 días
  GRUPOS_BASE: ['Servidor', 'Inducción', 'Líder', 'Director'] as const,
};
