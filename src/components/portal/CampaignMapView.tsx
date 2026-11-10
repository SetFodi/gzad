'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export interface PlayPoint {
  lat: number
  lng: number
  count: number
}

interface CampaignMapViewProps {
  points: PlayPoint[]
}

export default function CampaignMapView({ points }: CampaignMapViewProps) {
  const center: [number, number] = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [41.7151, 44.8271]

  const maxCount = Math.max(...points.map(p => p.count), 1)

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p, i) => {
        const intensity = p.count / maxCount
        const radius = 5 + intensity * 9
        return (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              fillColor: '#CCF381',
              fillOpacity: 0.25 + intensity * 0.55,
              color: '#CCF381',
              weight: 1,
              opacity: 0.5 + intensity * 0.5,
            }}
          >
            <Popup>
              <div style={{ color: '#050505', fontSize: 13 }}>
                <strong>{p.count} play{p.count !== 1 ? 's' : ''}</strong><br />
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
