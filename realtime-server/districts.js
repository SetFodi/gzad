// Tbilisi district polygons — mirrors src/lib/districts.ts
// [lat, lng] pairs, ray-casting point-in-polygon

const DISTRICTS = [
  {
    name: 'Mtatsminda',
    polygon: [[41.706,44.768],[41.706,44.826],[41.693,44.826],[41.682,44.812],[41.678,44.795],[41.680,44.768]],
  },
  {
    name: 'Vake',
    polygon: [[41.776,44.718],[41.776,44.800],[41.706,44.800],[41.706,44.768],[41.695,44.718]],
  },
  {
    name: 'Saburtalo',
    polygon: [[41.842,44.718],[41.842,44.802],[41.776,44.802],[41.776,44.718]],
  },
  {
    name: 'Chughureti',
    polygon: [[41.739,44.782],[41.739,44.850],[41.683,44.850],[41.683,44.826],[41.693,44.826],[41.706,44.826],[41.706,44.782]],
  },
  {
    name: 'Didube',
    polygon: [[41.796,44.782],[41.796,44.850],[41.739,44.850],[41.739,44.782]],
  },
  {
    name: 'Nadzaladevi',
    polygon: [[41.800,44.848],[41.800,44.915],[41.739,44.915],[41.739,44.848]],
  },
  {
    name: 'Gldani',
    polygon: [[41.895,44.798],[41.895,44.915],[41.800,44.915],[41.800,44.798]],
  },
  {
    name: 'Isani',
    polygon: [[41.706,44.826],[41.706,44.910],[41.660,44.910],[41.660,44.826],[41.682,44.812],[41.693,44.826]],
  },
  {
    name: 'Samgori',
    polygon: [[41.693,44.908],[41.693,45.015],[41.605,45.015],[41.605,44.908]],
  },
  {
    name: 'Krtsanisi',
    polygon: [[41.700,44.793],[41.700,44.870],[41.660,44.870],[41.655,44.840],[41.660,44.826],[41.660,44.793]],
  },
]

function pointInPolygon(lat, lng, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function getDistrictsForPoint(lat, lng) {
  return DISTRICTS
    .filter(d => pointInPolygon(lat, lng, d.polygon))
    .map(d => d.name)
    .sort()
}

module.exports = { getDistrictsForPoint }
