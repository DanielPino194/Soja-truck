import { storage } from "./storage";
import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve("server/data/combined.json");

export async function seedDatabase() {
  const existingCount = storage.countPriceData();
  
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} price records, skipping seed.`);
  } else {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      storage.insertPriceData(raw);
      console.log(`Seeded ${raw.length} price records.`);
    }
  }

  const shockCount = storage.countShockEvents();
  if (shockCount === 0) {
    const shocks = [
      {
        date: "2024-07-19",
        type: "palm_oil",
        title: "Caída de inventarios de aceite de palma en Malasia",
        description: "MPOB reportó reducción del 18% en stocks de aceite de palma por sequía en Borneo. Exportaciones a India y China cayeron 12% mensual, generando presión alcista en aceites vegetales globales.",
        impact: "high",
        oil_impact_pct: 4.2,
        meal_impact_pct: 0.8,
      },
      {
        date: "2024-09-06",
        type: "port_strike",
        title: "Paro portuario en Up-River Argentina",
        description: "Trabajadores de los puertos de San Martín y General Lagos iniciaron paro por 72 horas. Aproximadamente 180,000 t de harina y aceite quedaron retenidas en bodegas de buques graneleros.",
        impact: "high",
        oil_impact_pct: 2.1,
        meal_impact_pct: 3.5,
      },
      {
        date: "2024-11-15",
        type: "weather",
        title: "Niña confirmada: impacto en cosecha sudamericana",
        description: "NOAA confirmó evento La Niña con probabilidad del 70%. Pronósticos para campaña 2024/25 en Argentina y Brasil indicaban déficit hídrico en zonas pampeanas clave para soja.",
        impact: "high",
        oil_impact_pct: 1.5,
        meal_impact_pct: 2.8,
      },
      {
        date: "2025-01-24",
        type: "policy",
        title: "Indonesia elimina restricciones de exportación de aceite de palma",
        description: "Gobierno indonesio levantó cuotas de exportación vigentes desde 2022. El mercado reaccionó con baja del aceite de soja ante mayor competencia del aceite de palma en mercados asiáticos.",
        impact: "medium",
        oil_impact_pct: -3.2,
        meal_impact_pct: 0.5,
      },
      {
        date: "2025-03-10",
        type: "policy",
        title: "China suspende importaciones de soja de Brasil",
        description: "Medida fitosanitaria de China bloqueó temporalmente cargamentos de soja brasileña. Operadores redirigieron demanda hacia harina argentina, generando presión alcista en subproductos locales.",
        impact: "medium",
        oil_impact_pct: 1.8,
        meal_impact_pct: 4.1,
      },
      {
        date: "2025-07-04",
        type: "palm_oil",
        title: "Producción récord de palma en Indonesia Q2",
        description: "Gapki reportó producción de aceite de palma en 15.2 Mt para Q2 2025, 8% por encima del año anterior. Los stocks en puertos malayos superaron los 2.2 Mt por primera vez en 18 meses.",
        impact: "medium",
        oil_impact_pct: -2.7,
        meal_impact_pct: -0.3,
      },
      {
        date: "2025-09-19",
        type: "port_strike",
        title: "Conflicto gremial en Puerto de Rosario",
        description: "Sindicato de trabajadores de terminales portuarias inició medidas de fuerza por 48 horas. Se estimaron pérdidas de divisas por USD 120M/día para el complejo oleaginoso del Gran Rosario.",
        impact: "high",
        oil_impact_pct: 1.9,
        meal_impact_pct: 2.4,
      },
      {
        date: "2026-01-12",
        type: "weather",
        title: "Calor extremo en zona núcleo argentina",
        description: "Ola de calor con temperaturas >40°C en Santa Fe y Córdoba durante período crítico de llenado de vainas. BCBA estimó merma potencial de 3-5 Mt en producción de soja 2025/26.",
        impact: "high",
        oil_impact_pct: 3.8,
        meal_impact_pct: 5.2,
      },
      {
        date: "2026-03-28",
        type: "policy",
        title: "USDA rebaja stocks finales de soja en WASDE",
        description: "WASDE de marzo 2026 redujo estimación de stocks finales globales de soja en 4.2 Mt respecto al mes anterior, principalmente por menores rendimientos en Argentina y EE.UU.",
        impact: "medium",
        oil_impact_pct: 2.3,
        meal_impact_pct: 3.1,
      },
    ];

    for (const shock of shocks) {
      storage.insertShockEvent(shock);
    }
    console.log(`Seeded ${shocks.length} shock events.`);
  }
}
