'use client'

import { useId } from 'react'
import type { Ad } from './copy'
import RoofScreen from './RoofScreen'
import TbilisiBackdrop from './TbilisiBackdrop'

const CAR = '/landing/demo-sedan-premium.png'
const CAR_SCALE = 0.51
const CAR_X = 51.23
const CAR_Y = 36.79
const WHEEL_RADIUS = 140

function CarImage({ silhouette, bodyMask }: { silhouette: string; bodyMask: string }) {
  return (
    <g transform={`translate(${CAR_X} ${CAR_Y}) scale(${CAR_SCALE})`}>
      <g clipPath={`url(#${silhouette})`} mask={`url(#${bodyMask})`}>
        <image href={CAR} width="1774" height="887" />
      </g>
    </g>
  )
}

// The body mask removes the stationary spokes first. Each circular sprite
// then supplies the only wheel image at that axle and turns as one piece.
function Wheel({ x, name }: { x: number; name: string }) {
  const diameter = WHEEL_RADIUS * 2
  return (
    <div
      className="lp-taxi-wheel"
      data-wheel={name}
      style={{
        left: `${(CAR_X + x * CAR_SCALE) / 10}%`,
        top: `${((CAR_Y + 626 * CAR_SCALE) / 460) * 100}%`,
        width: `${(diameter * CAR_SCALE) / 10}%`,
      }}
      aria-hidden
    >
      <div className="lp-taxi-wheel-skin" style={{
        backgroundImage: `url(${CAR})`,
        backgroundSize: `${(1774 / diameter) * 100}% ${(887 / diameter) * 100}%`,
        backgroundPosition: `${((x - WHEEL_RADIUS) / (1774 - diameter)) * 100}% ${((626 - WHEEL_RADIUS) / (887 - diameter)) * 100}%`,
      }} />
    </div>
  )
}

/** An original, unbranded sport sedan carrying the live LED demonstration. */
export default function TaxiDrive({ ads, index, playing, label }: { ads: Ad[]; index: number; playing: boolean; label: string }) {
  const id = useId().replace(/:/g, '')
  const silhouette = `${id}-car-silhouette`
  const bodyMask = `${id}-stationary-body`

  return (
    <div className="lp-drive-scene" data-playing={playing || undefined} data-theme={ads[index % ads.length].theme} role="group" aria-label={label}>
      <div className="lp-drive-haze" aria-hidden />
      <TbilisiBackdrop />
      <div className="lp-drive-road" aria-hidden>
        <div className="lp-drive-road-edge" />
        <div className="lp-drive-lanes" />
        <div className="lp-drive-road-light" />
      </div>
      <div className="lp-taxi">
        <div className="lp-taxi-ground-shadow" aria-hidden />
        <svg className="lp-taxi-car" viewBox="0 0 1000 460" fill="none" aria-hidden>
          <defs>
            <mask id={bodyMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1774" height="887">
              <rect width="1774" height="887" fill="#fff" />
              <circle cx="405" cy="626" r="138.5" fill="#000" />
              <circle cx="1452" cy="626" r="138.5" fill="#000" />
            </mask>
            <clipPath id={silhouette}>
              <path d="M29 514 38 456 49 390 48 363Q189 351 275 313Q452 220 564 203Q720 184 909 199Q1037 209 1132 276L1268 357Q1455 365 1630 404L1724 450Q1749 480 1753 520V650Q1736 670 1612 682L1588 688 1576 699 1326 695H550L261 690Q150 688 50 655Q28 599 29 514Z" />
              <circle cx="405" cy="626" r="147" />
              <circle cx="1452" cy="626" r="147" />
            </clipPath>
          </defs>
          <path d="M940 305 1000 278V369L941 331Z" fill="#fff6d8" opacity="0.035" />
          <CarImage silhouette={silhouette} bodyMask={bodyMask} />
        </svg>
        <Wheel x={405} name="rear" />
        <Wheel x={1452} name="front" />
        <RoofScreen ads={ads} index={index} glow led playing={playing} className="lp-taxi-screen" />
      </div>
      <div className="lp-drive-vignette" aria-hidden />
    </div>
  )
}
