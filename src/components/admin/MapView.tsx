'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface GpsPoint {
  id: string
  device_serial: string
  lat: number
  lng: number
  speed: number
  recorded_at: string
}

interface MapViewProps {
  positions: GpsPoint[]
  allPoints: GpsPoint[]
}

// Custom marker icon (green dot)
const deviceIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#CCF381;border:2px solid #050505;box-shadow:0 0 8px rgba(204,243,129,0.6)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
})

export default function MapView({ positions, allPoints }: MapViewProps) {
  // Center on Tbilisi by default, or on first device
  const center: [number, number] = positions.length > 0
    ? [positions[0].lat, positions[0].lng]
    : [41.7151, 44.8271] // Tbilisi

  // Group trail points by device
  const trails = new Map<string, [number, number][]>()
  for (const p of allPoints) {
    if (!trails.has(p.device_serial)) {
      trails.set(p.device_serial, [])
    }
    trails.get(p.device_serial)!.push([p.lat, p.lng])
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Device trails */}
      {Array.from(trails.entries()).map(([deviceId, trail]) => (
        <Polyline
          key={deviceId}
          positions={trail}
          color="#CCF381"
          weight={3}
          opacity={0.5}
        />
      ))}

      {/* Latest device positions */}
      {positions.map((p) => (
        <Marker key={p.device_serial} position={[p.lat, p.lng]} icon={deviceIcon}>
          <Popup>
            <div style={{ color: '#050505', fontSize: 13 }}>
              <strong>{p.device_serial}</strong><br />
              Speed: {p.speed} km/h<br />
              Last update: {new Date(p.recorded_at).toLocaleString()}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
