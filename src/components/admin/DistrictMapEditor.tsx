'use client'

import { Fragment } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface DistrictData {
  name: string
  color: string
  polygon: [number, number][]
}

interface DistrictMapEditorProps {
  districts: DistrictData[]
  selectedDistrict: string | null
  onChange: (districts: DistrictData[]) => void
}

function vertexIcon(color: string, selected: boolean) {
  const size = selected ? 14 : 10
  return new L.DivIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.5);cursor:grab"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  })
}

function midpointIcon(color: string) {
  return new L.DivIcon({
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${color};opacity:0.4;border:1px solid #fff;cursor:pointer"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
    className: '',
  })
}

export default function DistrictMapEditor({ districts, selectedDistrict, onChange }: DistrictMapEditorProps) {
  const center: [number, number] = [41.7351, 44.8271]

  function handleVertexDrag(districtIndex: number, vertexIndex: number, latlng: L.LatLng) {
    const updated = districts.map((d, di) => {
      if (di !== districtIndex) return d
      const newPolygon = [...d.polygon] as [number, number][]
      newPolygon[vertexIndex] = [
        Math.round(latlng.lat * 1000000) / 1000000,
        Math.round(latlng.lng * 1000000) / 1000000,
      ]
      return { ...d, polygon: newPolygon }
    })
    onChange(updated)
  }

  function addVertex(districtIndex: number, afterIndex: number) {
    const updated = districts.map((d, di) => {
      if (di !== districtIndex) return d
      const poly = d.polygon
      const nextIndex = (afterIndex + 1) % poly.length
      const midLat = (poly[afterIndex][0] + poly[nextIndex][0]) / 2
      const midLng = (poly[afterIndex][1] + poly[nextIndex][1]) / 2
      const newPolygon = [...poly]
      newPolygon.splice(afterIndex + 1, 0, [
        Math.round(midLat * 1000000) / 1000000,
        Math.round(midLng * 1000000) / 1000000,
      ])
      return { ...d, polygon: newPolygon }
    })
    onChange(updated)
  }

  function removeVertex(districtIndex: number, vertexIndex: number) {
    const d = districts[districtIndex]
    if (d.polygon.length <= 3) return // need at least 3 vertices
    const updated = districts.map((d, di) => {
      if (di !== districtIndex) return d
      const newPolygon = d.polygon.filter((_, vi) => vi !== vertexIndex)
      return { ...d, polygon: newPolygon }
    })
    onChange(updated)
  }

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {districts.map((district, di) => {
        const isSelected = selectedDistrict === district.name || !selectedDistrict
        return (
          <Fragment key={district.name}>
            <Polygon
              positions={district.polygon}
              pathOptions={{
                color: district.color,
                weight: isSelected ? 3 : 1,
                opacity: isSelected ? 0.9 : 0.3,
                fillColor: district.color,
                fillOpacity: isSelected ? 0.25 : 0.08,
              }}
            >
              <Tooltip sticky>{district.name}</Tooltip>
            </Polygon>

            {/* Draggable vertex markers (only for selected/all) */}
            {isSelected && district.polygon.map((vertex, vi) => (
              <Marker
                key={`v-${district.name}-${vi}`}
                position={vertex}
                icon={vertexIcon(district.color, selectedDistrict === district.name)}
                draggable
                eventHandlers={{
                  dragend: (e) => handleVertexDrag(di, vi, e.target.getLatLng()),
                  contextmenu: (e) => {
                    e.originalEvent.preventDefault()
                    removeVertex(di, vi)
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  {district.name} #{vi + 1}<br />
                  {vertex[0].toFixed(4)}, {vertex[1].toFixed(4)}<br />
                  <em style={{ fontSize: 10 }}>Right-click to remove</em>
                </Tooltip>
              </Marker>
            ))}

            {/* Midpoint markers to add new vertices */}
            {selectedDistrict === district.name && district.polygon.map((vertex, vi) => {
              const next = district.polygon[(vi + 1) % district.polygon.length]
              const mid: [number, number] = [(vertex[0] + next[0]) / 2, (vertex[1] + next[1]) / 2]
              return (
                <Marker
                  key={`mid-${district.name}-${vi}`}
                  position={mid}
                  icon={midpointIcon(district.color)}
                  eventHandlers={{
                    click: () => addVertex(di, vi),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>Click to add vertex</Tooltip>
                </Marker>
              )
            })}
          </Fragment>
        )
      })}
    </MapContainer>
  )
}
