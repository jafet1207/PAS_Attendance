/**
 * Siembra datos sintéticos de demostración (idempotente): un puñado de servidores repartidos
 * en los 4 grupos y un par de servicios (uno con ventana abierta, otro ya vencido) para poder
 * recorrer la aplicación de punta a punta sin capturar nada a mano. No usa datos reales.
 *
 * Uso: npx tsx src/scripts/seedDemo.ts   (desde backend/, con DATABASE_URL configurada)
 */
import { initDb } from '../db/index.js';
import { GrupoModel } from '../models/grupo.model.js';
import { ParticipanteModel } from '../models/participante.model.js';
import { ServicioModel } from '../models/servicio.model.js';
import { formatDateYMD } from '../services/serviciosService.js';

interface ParticipanteDemo {
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correo: string;
  grupo: 'Servidor' | 'Inducción' | 'Líder' | 'Director';
}

const PARTICIPANTES_DEMO: ParticipanteDemo[] = [
  { nombre: 'María', primerApellido: 'Rojas', segundoApellido: 'Solano', correo: 'maria.rojas@ejemplo-sintetico.test', grupo: 'Servidor' },
  { nombre: 'Carlos', primerApellido: 'Jiménez', segundoApellido: null, correo: 'carlos.jimenez@ejemplo-sintetico.test', grupo: 'Servidor' },
  { nombre: 'Ana', primerApellido: 'Vargas', segundoApellido: 'Mora', correo: 'ana.vargas@ejemplo-sintetico.test', grupo: 'Servidor' },
  { nombre: 'Luis', primerApellido: 'Castro', segundoApellido: null, correo: 'luis.castro@ejemplo-sintetico.test', grupo: 'Servidor' },
  { nombre: 'Sofía', primerApellido: 'Méndez', segundoApellido: 'Alfaro', correo: 'sofia.mendez@ejemplo-sintetico.test', grupo: 'Inducción' },
  { nombre: 'Diego', primerApellido: 'Araya', segundoApellido: null, correo: 'diego.araya@ejemplo-sintetico.test', grupo: 'Inducción' },
  { nombre: 'Paula', primerApellido: 'Chinchilla', segundoApellido: null, correo: 'paula.chinchilla@ejemplo-sintetico.test', grupo: 'Líder' },
  { nombre: 'Andrés', primerApellido: 'Solís', segundoApellido: 'Barrantes', correo: 'andres.solis@ejemplo-sintetico.test', grupo: 'Director' },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function sembrarParticipantes(): Promise<void> {
  const grupos = await GrupoModel.getAll();
  const grupoIdPorNombre = new Map(grupos.map((g) => [g.nombre, g.id]));
  const existentes = await ParticipanteModel.getAll();
  const correosExistentes = new Set(existentes.map((p) => p.correo));

  for (const p of PARTICIPANTES_DEMO) {
    if (correosExistentes.has(p.correo)) {
      console.log(`[seedDemo] Ya existe, se omite: ${p.correo}`);
      continue;
    }
    const grupoId = grupoIdPorNombre.get(p.grupo);
    if (!grupoId) {
      console.warn(`[seedDemo] Grupo "${p.grupo}" no encontrado, se omite ${p.correo}`);
      continue;
    }
    await ParticipanteModel.create(p.nombre, p.primerApellido, p.segundoApellido, p.correo, grupoId);
    console.log(`[seedDemo] Creado: ${p.nombre} ${p.primerApellido} (${p.grupo})`);
  }
}

async function sembrarServicios(): Promise<void> {
  const existentes = await ServicioModel.getAll();

  const definiciones: { fechaServicio: string; horaServicio: string; fechaCierre: string; tipo: 'Regular' | 'Extraordinario' }[] = [
    // Servicio con ventana de confirmación abierta: el recorrido principal de la demo.
    { fechaServicio: addDays(7), horaServicio: '09:00', fechaCierre: addDays(4), tipo: 'Regular' },
    // Servicio ya vencido, para mostrar variedad de estados en el dashboard (RN-3/RN-4).
    { fechaServicio: addDays(-3), horaServicio: '18:00', fechaCierre: addDays(-6), tipo: 'Extraordinario' },
  ];

  for (const def of definiciones) {
    const yaExiste = existentes.some(
      (s) => formatDateYMD(s.fecha_servicio) === def.fechaServicio && s.tipo === def.tipo
    );
    if (yaExiste) {
      console.log(`[seedDemo] Ya existe un servicio ${def.tipo} el ${def.fechaServicio}, se omite`);
      continue;
    }
    await ServicioModel.create(def.fechaServicio, def.horaServicio, def.fechaCierre, def.tipo);
    console.log(`[seedDemo] Creado servicio ${def.tipo} el ${def.fechaServicio}`);
  }
}

async function main(): Promise<void> {
  await initDb();
  await sembrarParticipantes();
  await sembrarServicios();
  console.log('[seedDemo] Listo.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[seedDemo] Error al sembrar datos de demostración:', error);
  process.exit(1);
});
