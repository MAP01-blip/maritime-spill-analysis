"use client"

import { useEffect, useMemo } from "react"
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  ScaleControl,
  TileLayer,
  useMap,
} from "react-leaflet"
import type { LatLngExpression } from "leaflet"
import { getSpillLocationLabel, type Sample } from "@/components/dataset-explorer"
import {
  getVesselCandidatesForSample,
  type VesselAttributionData,
} from "@/components/vessel-attribution-box"

function MapViewport({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.75 })
  }, [center, map, zoom])

  return null
}

export function RealWorldMap({
  sample,
  zoom,
  selectedCandidateRank = 1,
  onSelectCandidateRank,
}: {
  sample: Sample
  zoom: number
  selectedCandidateRank?: number
  onSelectCandidateRank?: (rank: number) => void
}) {
  const center: LatLngExpression = useMemo(
    () => [sample.location.lat, sample.location.lon],
    [sample.location.lat, sample.location.lon]
  )
  const spillRadiusMeters = Math.max(
    Math.sqrt((sample.area_km2 * 1_000_000) / Math.PI),
    300
  )
  const spillRadiusKm = spillRadiusMeters / 1000

  // Compute full ranked candidate fleet for this spill
  const candidates: VesselAttributionData[] = useMemo(() => {
    return getVesselCandidatesForSample(sample)
  }, [sample])

  // Active selected candidate based on the right panel selection
  const activeVessel =
    candidates.find((c) => c.ranking === selectedCandidateRank) || candidates[0]

  const activeIndex = Math.max(
    0,
    candidates.findIndex((c) => c.ranking === activeVessel.ranking)
  )

  // Backward-drift corridor & multiple candidate vessel coordinates
  const geometry = useMemo(() => {
    const lat = sample.location.lat
    const lon = sample.location.lon

    const numId = parseInt(sample.id) || 1
    const angleDeg = (numId * 47) % 360
    const rad = (angleDeg * Math.PI) / 180

    const dy = Math.sin(rad)
    const dx = Math.cos(rad)

    const cosLat = Math.cos((lat * Math.PI) / 180) || 1
    const degPerKmLat = 1 / 111.32
    const degPerKmLon = 1 / (111.32 * cosLat)

    // Corridor length ~ 8.5 km backward in time
    const corridorLenKm = 8.5
    const originLat = lat + dy * corridorLenKm * degPerKmLat
    const originLon = lon + dx * corridorLenKm * degPerKmLon

    // Perpendicular direction for corridor width
    const perpY = -dx
    const perpX = dy
    const halfWidthKm = 0.65

    const c1: [number, number] = [
      lat + perpY * halfWidthKm * degPerKmLat,
      lon + perpX * halfWidthKm * degPerKmLon,
    ]
    const c2: [number, number] = [
      originLat + perpY * halfWidthKm * degPerKmLat,
      originLon + perpX * halfWidthKm * degPerKmLon,
    ]
    const c3: [number, number] = [
      originLat - perpY * halfWidthKm * degPerKmLat,
      originLon - perpX * halfWidthKm * degPerKmLon,
    ]
    const c4: [number, number] = [
      lat - perpY * halfWidthKm * degPerKmLat,
      lon - perpX * halfWidthKm * degPerKmLon,
    ]

    // Candidate #1: Core/Margin corridor position
    const offset1 = candidates[0]?.corridorOffsetKm || 0.4
    const v1Lat = originLat + perpY * offset1 * degPerKmLat
    const v1Lon = originLon + perpX * offset1 * degPerKmLon

    // Candidate #2: Secondary position (corridor margin)
    const offset2 = candidates[1]?.corridorOffsetKm || 2.0
    const v2Lat = originLat + (perpY * offset2 + dy * 1.5) * degPerKmLat
    const v2Lon = originLon + (perpX * offset2 + dx * 1.5) * degPerKmLon

    // Candidate #3: Outer position (exonerated / control)
    const offset3 = candidates[2]?.corridorOffsetKm || 12.0
    const v3Lat = originLat + (perpY * offset3 - dy * 3.0) * degPerKmLat
    const v3Lon = originLon + (perpX * offset3 - dx * 3.0) * degPerKmLon

    const vesselPoints: [number, number][] = [
      [v1Lat, v1Lon],
      [v2Lat, v2Lon],
      [v3Lat, v3Lon],
    ]

    const activePoint = vesselPoints[activeIndex] || vesselPoints[0]

    return {
      corridorPolygon: [c1, c2, c3, c4] as [number, number][],
      corridorCenterline: [
        [lat, lon],
        [originLat, originLon],
      ] as [number, number][],
      originPoint: [originLat, originLon] as [number, number],
      vesselPoints,
      activePoint,
      distanceVector: [
        [originLat, originLon],
        activePoint,
      ] as [number, number][],
    }
  }, [sample, candidates, activeIndex])

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#d8d9d5]">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom
        zoomControl
        className="h-full min-h-0 w-full"
      >
        <ScaleControl position="bottomleft" metric imperial={false} maxWidth={140} />
        <MapViewport center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* 1. Shaded Backward-drift Source Corridor (Corridor S) */}
        <Polygon
          positions={geometry.corridorPolygon}
          pathOptions={{
            color: "#0284c7",
            fillColor: "#0284c7",
            fillOpacity: 0.22,
            weight: 1.5,
            dashArray: "6 4",
          }}
        >
          <Popup>
            <div className="text-xs font-mono">
              <strong className="text-sky-800">Source Corridor (Corridor S)</strong>
              <br />
              Reverse Lagrangian hindcast drift envelope
              <br />
              Corridor length: ~8.5 km
            </div>
          </Popup>
        </Polygon>

        {/* 2. Corridor Centerline (Hindcast drift trajectory) */}
        <Polyline
          positions={geometry.corridorCenterline}
          pathOptions={{
            color: "#0ea5e9",
            weight: 2,
            dashArray: "4 6",
            opacity: 0.8,
          }}
        />

        {/* 3. Distance measurement connector for currently selected candidate */}
        <Polyline
          positions={geometry.distanceVector}
          pathOptions={{
            color:
              activeVessel.ranking === 1
                ? "#06b6d4"
                : activeVessel.ranking === 2
                ? "#f59e0b"
                : "#a855f7",
            weight: 3,
            dashArray: "4 4",
            opacity: 0.95,
          }}
        />

        {/* 4. Oil Spill Slick Surface Polygon & Center Marker */}
        <Circle
          center={center}
          radius={spillRadiusMeters}
          pathOptions={{
            color: "#1e293b",
            fillColor: "#475569",
            fillOpacity: 0.5,
            weight: 2.5,
            opacity: 0.95,
            dashArray: "8 5",
          }}
        />
        <CircleMarker
          center={center}
          radius={7}
          pathOptions={{
            color: "#082f49",
            fillColor: "#06b6d4",
            fillOpacity: 1,
            weight: 2.5,
          }}
        >
          <Popup>
            <div className="font-sans text-xs">
              <strong className="font-bold text-slate-900">Sample #{sample.id}</strong>
              <div className="font-mono text-[11px] text-slate-600">
                {sample.location.lat.toFixed(3)}°, {sample.location.lon.toFixed(3)}°
              </div>
              <div className="text-slate-700">{sample.location.region}</div>
              <div className="font-semibold text-cyan-800">
                {getSpillLocationLabel(sample.spillLocationClass)}
              </div>
              <div className="mt-1 border-t border-slate-200 pt-1 font-mono text-[11px]">
                Area: {sample.area_km2.toFixed(1)} km²
              </div>
            </div>
          </Popup>
        </CircleMarker>

        {/* 5. Candidate Vessels Plotted on Map */}
        {candidates.map((cand, idx) => {
          const pt = geometry.vesselPoints[idx]
          if (!pt) return null
          const isSelected = cand.ranking === activeVessel.ranking
          const markerColor =
            cand.ranking === 1 ? "#0284c7" : cand.ranking === 2 ? "#d97706" : "#64748b"
          const fillColor =
            cand.ranking === 1 ? "#38bdf8" : cand.ranking === 2 ? "#fbbf24" : "#94a3b8"

          return (
            <span key={cand.mmsi}>
              {/* Pulsating radar ping halo for the active selected vessel */}
              {isSelected && (
                <CircleMarker
                  center={pt}
                  radius={20}
                  pathOptions={{
                    color: markerColor,
                    fillColor,
                    fillOpacity: 0.25,
                    weight: 2,
                    dashArray: "4 4",
                  }}
                />
              )}
              {/* Target Marker */}
              <CircleMarker
                center={pt}
                radius={isSelected ? 10 : 6}
                eventHandlers={{
                  click: () => {
                    onSelectCandidateRank?.(cand.ranking)
                  },
                }}
                pathOptions={{
                  color: isSelected ? "#0f172a" : markerColor,
                  fillColor,
                  fillOpacity: 1,
                  weight: isSelected ? 3.5 : 2,
                }}
              >
                <Popup>
                  <div className="min-w-44 font-sans text-xs">
                    <div className="font-bold text-slate-900">{cand.name}</div>
                    <div className="font-mono text-[11px] font-semibold text-slate-700">
                      RANK #{cand.ranking} · MMSI {cand.mmsi}
                    </div>
                    <div className="mt-1 border-t border-slate-200 pt-1 text-[11px] text-slate-700">
                      Cargo: <strong>{cand.oilType}</strong>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      Corridor dist: <strong>{cand.corridorDistance}</strong>
                    </div>
                    <div className="mt-1 font-mono font-bold text-slate-900">
                      Confidence: {(cand.confidenceScore * 100).toFixed(0)}%
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </span>
          )
        })}
      </MapContainer>

      {/* Top Left: Live Map Position & Dynamic Selected Vessel Target Info HUD */}
      <div className="pointer-events-none absolute left-3 top-3 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-300/80 bg-white/95 p-3 font-mono text-[11px] text-slate-700 shadow-lg backdrop-blur-md z-[1000]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5">
          <div className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
            LIVE MAP POSITION
          </div>
          <span className="font-bold text-slate-900">
            {sample.location.lat.toFixed(3)}°N · {sample.location.lon.toFixed(3)}°E
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
          <span>{sample.location.region}</span>
          <span className="font-semibold text-cyan-800">
            {getSpillLocationLabel(sample.spillLocationClass)}
          </span>
        </div>

        <div className="text-[10px] text-slate-600 border-b border-slate-200 pb-1.5 mb-2">
          Spill: <strong className="text-slate-900">{sample.area_km2.toFixed(1)} km²</strong> · radius: <strong className="text-slate-900">{spillRadiusKm.toFixed(2)} km</strong>
        </div>

        {/* Dynamic target vessel info that immediately changes when clicking right panel */}
        <div className="rounded-md bg-slate-100/95 border border-slate-200/90 p-2 font-sans transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900 flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-cyan-600 animate-pulse" />
              TARGET #{activeVessel.ranking} · {activeVessel.rankingLabel}
            </span>
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase border ${
                activeVessel.confidenceScore >= 0.7
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : activeVessel.confidenceScore >= 0.4
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-slate-200 text-slate-700 border-slate-300"
              }`}
            >
              {(activeVessel.confidenceScore * 100).toFixed(0)}%
            </span>
          </div>

          <div className="font-bold text-slate-950 text-xs mt-1 truncate">
            {activeVessel.name}
          </div>

          <div className="flex items-center justify-between font-mono text-[10px] text-slate-600 mt-0.5">
            <span>
              {activeVessel.mmsi.startsWith("MMSI")
                ? activeVessel.mmsi
                : `MMSI ${activeVessel.mmsi}`}
            </span>
            <span className="font-medium text-slate-800">
              {activeVessel.corridorDistance.split("(")[0]}
            </span>
          </div>

          <div className="text-[10px] text-amber-900 font-medium truncate mt-1 pt-1 border-t border-slate-200/70">
            Cargo: {activeVessel.oilType}
          </div>
        </div>
      </div>
    </div>
  )
}
