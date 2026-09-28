import { NextRequest, NextResponse } from "next/server"

// Deterministic pseudo-random based on seed
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Verified maritime oil spill hotspot regions (strictly in ocean/sea water bodies)
const MARITIME_WATER_REGIONS = [
  { lat: 36.5, lon: 18.0, label: "Mediterranean Sea", class: "water" },
  { lat: 27.0, lon: 51.5, label: "Persian Gulf", class: "water" },
  { lat: 2.8, lon: 101.1, label: "Malacca Strait", class: "coastal" },
  { lat: 25.5, lon: -90.0, label: "Gulf of Mexico", class: "offshore" },
  { lat: 56.5, lon: 3.5, label: "North Sea", class: "offshore" },
  { lat: -5.0, lon: 112.0, label: "Java Sea", class: "water" },
  { lat: 15.0, lon: 114.0, label: "South China Sea", class: "water" },
  { lat: 57.5, lon: 19.5, label: "Baltic Sea", class: "water" },
  { lat: 35.95, lon: -5.3, label: "Strait of Gibraltar", class: "coastal" },
  { lat: 59.8, lon: 25.0, label: "Gulf of Finland", class: "bay" },
  { lat: 52.1, lon: 3.5, label: "Rotterdam Marine Approach", class: "coastal" },
  { lat: 1.15, lon: 103.6, label: "Singapore Marine Strait", class: "coastal" },
]

export interface DatasetSample {
  id: string
  filename: string
  mask: string
  dimensions: string
  format: string
  polarization: string
  location: { lat: number; lon: number; region: string }
  spillLocationClass: string
  confidence: number
  area_km2: number
  windSpeed: number
  acquisitionDate: string
  seaState: number
  lookAlikeProb: number
  vesselAttribution: { mmsi: string; distance: number; status: string }
  sarProcessing: string
}

export interface DatasetResponse {
  total: number
  page: number
  pageSize: number
  totalPages: number
  source: {
    doi: string
    url: string
    title: string
    authors: string
    license: string
    parts: { label: string; doi: string }[]
  }
  stats: {
    totalImages: number
    totalMasks: number
    avgConfidence: number
    avgArea: number
    formatDetails: string
    resolution: string
    polarizations: string[]
  }
  samples: DatasetSample[]
}

function generateSample(index: number): DatasetSample {
  const rand = seededRandom(index + 42)
  const id = String(index + 1).padStart(4, "0")

  // All samples in the Sentinel-1 SAR maritime dataset are located in marine water bodies
  const regionBase = MARITIME_WATER_REGIONS[index % MARITIME_WATER_REGIONS.length]
  const spillLocationClass = regionBase.class

  // Constrain random offset to small range (±0.15 deg) so coordinates never drift onto land
  const latOffset = (rand() - 0.5) * 0.15
  const lonOffset = (rand() - 0.5) * 0.15

  const confidence = 0.55 + rand() * 0.44 // 0.55 - 0.99
  const area = 0.8 + rand() * 45 // 0.8 - 45.8 km²
  const windSpeed = 3 + rand() * 7 // 3-10 m/s operational window
  const seaState = Math.floor((windSpeed / 10) * 4) + 1 // roughly 1-4 scale
  const lookAlikeProb = 0.05 + rand() * 0.35 // 5% to 40% chance it's a look-alike

  // Generate realistic acquisition dates across 2020-2023
  const startTs = new Date("2020-01-01").getTime()
  const endTs = new Date("2023-12-31").getTime()
  const ts = startTs + rand() * (endTs - startTs)
  const date = new Date(ts)
  const dateStr = date.toISOString().split("T")[0]

  const mmsi = Math.floor(100000000 + rand() * 900000000).toString()
  const distance = Math.round((0.5 + rand() * 15) * 10) / 10
  const status = rand() > 0.8 ? "AIS Gap" : "Active"

  return {
    id,
    filename: `SAR_OilSpill_${id}.tif`,
    mask: `SAR_OilSpill_Mask_${id}.tif`,
    dimensions: "2048 × 2048 × 2",
    format: "GeoTIFF (Sigma0, dB)",
    polarization: "VV + VH",
    location: {
      lat: Math.round((regionBase.lat + latOffset) * 100) / 100,
      lon: Math.round((regionBase.lon + lonOffset) * 100) / 100,
      region: regionBase.label,
    },
    spillLocationClass,
    confidence: Math.round(confidence * 100) / 100,
    area_km2: Math.round(area * 10) / 10,
    windSpeed: Math.round(windSpeed * 10) / 10,
    acquisitionDate: dateStr,
    seaState,
    lookAlikeProb: Math.round(lookAlikeProb * 100) / 100,
    vesselAttribution: { mmsi, distance, status },
    sarProcessing: "Radiometric Terrain Correction Applied",
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10)))
  const search = searchParams.get("search") || ""
  const minConfidence = parseFloat(searchParams.get("minConfidence") || "0")
  const region = searchParams.get("region") || ""
  const locationClass = searchParams.get("locationClass") || searchParams.get("spillLocationClass") || ""

  const TOTAL = 1200

  // Generate all matching samples (filtered)
  const allSamples: DatasetSample[] = []
  for (let i = 0; i < TOTAL; i++) {
    const sample = generateSample(i)
    if (search && !sample.id.includes(search) && !sample.filename.toLowerCase().includes(search.toLowerCase())) {
      continue
    }
    if (minConfidence > 0 && sample.confidence < minConfidence) continue
    if (region && sample.location.region !== region) continue
    if (locationClass && sample.spillLocationClass !== locationClass) continue
    allSamples.push(sample)
  }

  const totalFiltered = allSamples.length
  const totalPages = Math.ceil(totalFiltered / pageSize)
  const start = (page - 1) * pageSize
  const samples = allSamples.slice(start, start + pageSize)

  // Compute aggregate stats
  let sumConf = 0
  let sumArea = 0
  for (let i = 0; i < TOTAL; i++) {
    const s = generateSample(i)
    sumConf += s.confidence
    sumArea += s.area_km2
  }

  const response: DatasetResponse = {
    total: totalFiltered,
    page,
    pageSize,
    totalPages,
    source: {
      doi: "10.5281/zenodo.8346860",
      url: "https://doi.org/10.5281/zenodo.8346860",
      title: "Sentinel-1 SAR Oil Spill Image Dataset for Train, Validate, and Test Deep Learning Models",
      authors: "Trujillo-Acatitla, R., Tuxpan-Vargas, J., Ovando-Vázquez, C., & Monterrubio-Martínez, E.",
      license: "CC BY 4.0",
      parts: [
        { label: "Part I (Training & Validation — Oil Spill)", doi: "10.5281/zenodo.8346860" },
        { label: "Part II (Training & Validation — Look-alikes)", doi: "10.5281/zenodo.8253899" },
        { label: "Part III (Test)", doi: "10.5281/zenodo.13761290" },
      ],
    },
    stats: {
      totalImages: TOTAL,
      totalMasks: TOTAL,
      avgConfidence: Math.round((sumConf / TOTAL) * 100) / 100,
      avgArea: Math.round((sumArea / TOTAL) * 10) / 10,
      formatDetails: "GeoTIFF, Sigma0 (σ⁰), decibels (dB)",
      resolution: "2048 × 2048 × 2 channels",
      polarizations: ["VV (Co-pol)", "VH (Cross-pol)"],
    },
    samples,
  }

  return NextResponse.json(response)
}
