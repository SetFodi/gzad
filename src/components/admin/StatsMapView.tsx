'use client'

import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { TBILISI_DISTRICTS } from '@/lib/districts'

interface PlayPoint {
  lat: number
  lng: number
  program_name: string
  device_id: string
  began_at: string
  duration_seconds: number
}

interface StatsMapViewProps {
  points: PlayPoint[]
  showDistricts?: boolean
}

export default function StatsMapView({ points, showDistricts = true }: StatsMapViewProps) {
  const center: [number, number] = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [41.7151, 44.8271]

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {showDistricts && TBILISI_DISTRICTS.map(district => (
        <Polygon
          key={district.name}
          positions={district.polygon}
          pathOptions={{
            color: district.color,
            weight: 2,
            opacity: 0.6,
            fillColor: district.color,
            fillOpacity: 0.15,
          }}
        >
          <Tooltip sticky>{district.name}</Tooltip>
        </Polygon>
      ))}

      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={5}
          pathOptions={{
            color: '#166534',
            fillColor: '#166534',
            fillOpacity: 0.7,
            weight: 1,
          }}
        >
          <Popup>
            <div style={{ color: '#050505', fontSize: 13, lineHeight: 1.5 }}>
              <strong>{p.program_name}</strong><br />
              Device: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.device_id}</span><br />
              Time: {new Date(p.began_at).toLocaleString()}<br />
              Duration: {p.duration_seconds}s
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
