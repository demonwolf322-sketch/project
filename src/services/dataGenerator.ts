/**
 * Synthetic Data Generator & Data Management
 * Faithfully mirrors generate_synthetic_data() and load_city_data() from app.py
 */

export interface PMRecord {
  date: string; // YYYY-MM-DD
  pm25: number;
  pm10: number;
}

export type CityName = "Kolkata" | "Siliguri" | "Haldia";

export interface CityDataStore {
  [city: string]: PMRecord[];
}

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 */
class SeededRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  // Returns float in [0, 1)
  random(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Box-Muller transform for normal distribution N(mean, stdDev)
  normal(mean = 0, stdDev = 1): number {
    let u1 = this.random();
    let u2 = this.random();
    while (u1 === 0) u1 = this.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

/**
 * Generates synthetic PM 2.5 and PM 10 data matching app.py
 * Kolkata: seed 42, base 65/110
 * Siliguri: seed 7, base 45/75
 * Haldia: seed 13, base 55/95
 */
export function generateSyntheticData(city: CityName, nDays = 365 * 3): PMRecord[] {
  const seeds: Record<CityName, number> = {
    Kolkata: 42,
    Siliguri: 7,
    Haldia: 13,
  };

  const basePm25: Record<CityName, number> = {
    Kolkata: 65,
    Siliguri: 45,
    Haldia: 55,
  };

  const basePm10: Record<CityName, number> = {
    Kolkata: 110,
    Siliguri: 75,
    Haldia: 95,
  };

  const rng = new SeededRNG(seeds[city]);
  const b25 = basePm25[city];
  const b10 = basePm10[city];

  const startDate = new Date(Date.UTC(2021, 0, 1));
  const records: PMRecord[] = [];

  for (let t = 0; t < nDays; t++) {
    const curDate = new Date(startDate.getTime() + t * 86400000);
    const dateStr = curDate.toISOString().slice(0, 10);

    const seasonal = 20 * Math.sin((2 * Math.PI * t) / 365) + 10 * Math.sin((2 * Math.PI * t) / 182);
    const trend = 0.01 * t;
    const noise25 = rng.normal(0, 8);
    const noise10 = rng.normal(0, 14);

    let pm25 = b25 + seasonal + trend + noise25;
    let pm10 = b10 + seasonal * 1.5 + trend * 1.2 + noise10;

    // np.clip(..., 5, 300) and (..., 10, 500)
    pm25 = Math.max(5, Math.min(300, pm25));
    pm10 = Math.max(10, Math.min(500, pm10));

    records.push({
      date: dateStr,
      pm25: Math.round(pm25 * 100) / 100,
      pm10: Math.round(pm10 * 100) / 100,
    });
  }

  return records;
}

export const SYNTHETIC_DATA: Record<CityName, PMRecord[]> = {
  Kolkata: generateSyntheticData("Kolkata"),
  Siliguri: generateSyntheticData("Siliguri"),
  Haldia: generateSyntheticData("Haldia"),
};

export function parseCSVData(csvText: string): PMRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("date");
  const pm25Idx = headers.indexOf("pm25");
  const pm10Idx = headers.indexOf("pm10");

  if (dateIdx === -1 || pm25Idx === -1 || pm10Idx === -1) {
    throw new Error("CSV must contain columns: date, pm25, pm10");
  }

  const results: PMRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((v) => v.trim());
    if (row.length <= Math.max(dateIdx, pm25Idx, pm10Idx)) continue;
    const dateStr = row[dateIdx];
    const pm25Val = parseFloat(row[pm25Idx]);
    const pm10Val = parseFloat(row[pm10Idx]);

    if (!isNaN(pm25Val) && !isNaN(pm10Val) && dateStr) {
      results.push({
        date: dateStr,
        pm25: Math.round(pm25Val * 100) / 100,
        pm10: Math.round(pm10Val * 100) / 100,
      });
    }
  }

  // Sort ascending by date
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

export function loadCityData(city: CityName, uploadedData: Partial<Record<CityName, PMRecord[]>>): PMRecord[] {
  if (uploadedData[city] && uploadedData[city]!.length > 0) {
    return uploadedData[city]!;
  }
  return SYNTHETIC_DATA[city];
}
