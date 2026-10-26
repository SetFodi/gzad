'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TBILISI_DISTRICTS } from '@/lib/districts'
import { useAdminText } from '@/lib/admin-i18n'

interface GpsPoint {
  id: string
  device_serial: string
  lat: number
  lng: number
  speed: number | null
  recorded_at: string
}

interface MapViewProps {
  positions: GpsPoint[]
  allPoints: GpsPoint[]
  showDistricts?: boolean
}

// Custom marker icon (green dot — matches brand green #166534)
const deviceIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#166534;border:2px solid #fff;box-shadow:0 0 8px rgba(22,101,52,0.6)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
})

export default function MapView({ positions, allPoints, showDistricts = false }: MapViewProps) {
  const { t, locale } = useAdminText()
  const center: [number, number] = positions.length > 0
    ? [positions[0].lat, positions[0].lng]
    : [41.7151, 44.8271]

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

      {/* District overlays */}
      {showDistricts && TBILISI_DISTRICTS.map(district => (
        <Polygon
          key={district.name}
          positions={district.polygon}
          pathOptions={{
            color: district.color,
            weight: 2,
            opacity: 0.8,
            fillColor: district.color,
            fillOpacity: 0.35,
          }}
        >
          <Tooltip sticky>{t(district.name)}</Tooltip>
        </Polygon>
      ))}

      {/* Device trails */}
      {Array.from(trails.entries()).map(([deviceId, trail]) => (
        <Polyline
          key={deviceId}
          positions={trail}
          color="#166534"
          weight={3}
          opacity={0.8}
        />
      ))}

      {/* Latest device positions */}
      {positions.map((p) => (
        <Marker key={p.device_serial} position={[p.lat, p.lng]} icon={deviceIcon}>
          <Popup>
            <div style={{ color: '#050505', fontSize: 13 }}>
              <strong>{p.device_serial}</strong><br />
              {t('Speed')}: {p.speed === null ? t('Not recorded') : t('{n} km/h', { n: p.speed })}<br />
              {t('Last update')}: {new Date(p.recorded_at).toLocaleString(locale, { timeZone: 'Asia/Tbilisi' })}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
