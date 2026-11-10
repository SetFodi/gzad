'use client'

import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, Tooltip } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L, { type MarkerCluster } from 'leaflet'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Monitor } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import { TBILISI_DISTRICTS } from '@/lib/districts'
import { useAdminText } from '@/lib/admin-i18n'

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

// Below this many plays every dot is drawn; above it nearby plays are grouped
// into a counted bubble until the map is zoomed in to street level.
const CLUSTER_FROM = 100

function clusterIcon(cluster: MarkerCluster) {
  const count = cluster.getChildCount()
  const size = count < 10 ? 30 : count < 100 ? 36 : count < 1000 ? 42 : 48
  return L.divIcon({
    html: `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:rgba(22,101,52,0.88);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);color:#fff;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums">${count.toLocaleString('en-US')}</span>`,
    className: '',
    iconSize: L.point(size, size),
  })
}

export default function StatsMapView({ points, showDistricts = true }: StatsMapViewProps) {
  const { t } = useAdminText()
  // Fleet users see this map too but can't open the admin Devices page.
  const isAdmin = usePathname()?.startsWith('/admin') ?? false
  const center: [number, number] = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [41.7151, 44.8271]
  const markers = <PlayMarkers points={points} />

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
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
            <Tooltip sticky>{t(district.name)}</Tooltip>
          </Polygon>
        ))}

        {points.length >= CLUSTER_FROM ? (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={45}
            disableClusteringAtZoom={17}
            showCoverageOnHover={false}
            iconCreateFunction={clusterIcon}
          >
            {markers}
          </MarkerClusterGroup>
        ) : markers}
      </MapContainer>
      {points.length === 0 && (
        // Above Leaflet's panes and controls; the map stays draggable around it.
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
          <div className="portal-empty portal-empty-sm" style={{ pointerEvents: 'auto', maxWidth: 380 }}>
            <p>{t('No plays with a GPS position match these filters.')}</p>
            {isAdmin && (
              <Link href="/admin/devices" className="portal-btn-secondary">
                <Monitor size={16} aria-hidden /> {t('Check screens are online')}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PlayMarkers({ points }: { points: PlayPoint[] }) {
  const { t, locale } = useAdminText()
  return (
    <>
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
              {t('Device')}: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.device_id}</span><br />
              {t('Time')}: {new Date(p.began_at).toLocaleString(locale, { timeZone: 'Asia/Tbilisi' })}<br />
              {t('Duration')}: {t('{s}s', { s: p.duration_seconds })}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
