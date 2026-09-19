"use client"

import { useEffect } from "react"
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  ScaleControl,
  TileLayer,
  useMap,
} from "react-leaflet"
import type { LatLngExpression } from "leaflet"
import { SarPreview } from "@/components/sar-preview"
import type { Sample } from "@/components/dataset-explorer"

function MapViewport({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom, { animate: true })
  }, [center, map, zoom])

  return null
}

export function RealWorldMap({ sample, zoom }: { sample: Sample; zoom: number }) {
  const center: LatLngExpression = [sample.location.lat, sample.location.lon]
  const spillRadiusMeters = Math.max(
    Math.sqrt((sample.area_km2 * 1_000_000) / Math.PI),
    300
  )
  const spillRadiusKm = spillRadiusMeters / 1000

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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={center}
          radius={spillRadiusMeters}
          pathOptions={{
            color: "#374151",
            fillColor: "#9ca3af",
            fillOpacity: 0.48,
            weight: 3,
            opacity: 0.95,
            dashArray: "8 5",
          }}
        />
        <CircleMarker
          center={center}
          radius={8}
          pathOptions={{
            color: "#082f49",
            fillColor: "#06b6d4",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            <strong>Sample #{sample.id}</strong>
            <br />
            {sample.location.lat.toFixed(3)}°, {sample.location.lon.toFixed(3)}°
            <br />
            {sample.location.region}
            <br />
            Spill area: {sample.area_km2.toFixed(1)} km²
          </Popup>
        </CircleMarker>
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-300/80 bg-white/90 px-3 py-2 font-mono text-[11px] text-slate-700 shadow-md backdrop-blur-sm">
        <div className="text-[9px] font-semibold tracking-wide text-slate-500">LIVE MAP POSITION</div>
        <div className="font-semibold text-slate-900">
          {sample.location.lat.toFixed(3)}°N · {sample.location.lon.toFixed(3)}°E
        </div>
        <div className="text-[10px] text-slate-500">{sample.location.region}</div>
        <div className="mt-1 border-t border-slate-300 pt-1 text-[10px] font-semibold text-slate-700">
          Spill: {sample.area_km2.toFixed(1)} km² · radius: {spillRadiusKm.toFixed(2)} km
        </div>
      </div>

      <div className="absolute bottom-3 right-3 w-36 overflow-hidden rounded-lg border-2 border-cyan-700/70 bg-slate-950 shadow-xl">
        <div className="border-b border-cyan-700/50 bg-slate-900 px-2 py-1 font-mono text-[9px] font-semibold tracking-wide text-cyan-300">
          SAR MASK · #{sample.id}
        </div>
        <SarPreview
          sampleId={parseInt(sample.id)}
          showMask
          maskOnly
          width={144}
          height={144}
          className="h-auto w-full rounded-none"
        />
      </div>
    </div>
  )
}
