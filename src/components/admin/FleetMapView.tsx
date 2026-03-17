'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'

export interface DevicePoint {
  id: string
  name: string | null
  lat: number
  lng: number
  online: boolean
  lastSeen: string | null
}

interface FleetMapViewProps {
  devices: DevicePoint[]
  focusedId?: string | null
}

function FocusDevice({ devices, focusedId }: { devices: DevicePoint[]; focusedId?: string | null }) {
  const map = useMap()
  useEffect(() => {
    if (!focusedId) return
    const d = devices.find(d => d.id === focusedId)
    if (d) map.setView([d.lat, d.lng], 15, { animate: true })
  }, [focusedId, map, devices])
  return null
}

const onlineIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#CCF381;border:2px solid #050505;box-shadow:0 0 10px rgba(204,243,129,0.7)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
})

const offlineIcon = new L.DivIcon({
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#525252;border:2px solid #050505"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  className: '',
})

export default function FleetMapView({ devices, focusedId }: FleetMapViewProps) {
  const center: [number, number] = devices.length > 0
    ? [devices[0].lat, devices[0].lng]
    : [41.7151, 44.8271]

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusDevice devices={devices} focusedId={focusedId} />
      {devices.map(d => (
        <Marker key={d.id} position={[d.lat, d.lng]} icon={d.online ? onlineIcon : offlineIcon}>
          <Popup>
            <div style={{ color: '#050505', fontSize: 13, minWidth: 160 }}>
              <strong>{d.name || d.id}</strong><br />
              <span style={{ color: d.online ? '#16a34a' : '#6b7280', fontWeight: 500 }}>
                {d.online ? '● Online' : '○ Offline'}
              </span><br />
              {d.lastSeen && (
                <span style={{ fontSize: 12 }}>
                  Last seen: {new Date(d.lastSeen).toLocaleString()}
                </span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
