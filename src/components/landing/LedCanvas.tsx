'use client'

import { useEffect, useRef } from 'react'
import type { Ad } from './copy'

// The controllers play every upload inside a 240 × 80 program (lib/device-sync).
// The demo lays everything out in those units but renders at 3× for a cleaner
// picture; the LED dot grid over the screen keeps the panel's texture.
const W = 240
const H = 80
const SCALE = 3

// Stock footage from Pexels (free for commercial use, no attribution required),
// cropped to 3:1 (720 × 240) and cut to six-second muted loops in public/landing:
// gym 6389051, bakery 7405932, rack 7669195, coffee 855391.
const VIDEO: Partial<Record<Ad['theme'], string>> = {
  sun: '/landing/bakery.mp4',
  cobalt: '/landing/gym.mp4',
  magenta: '/landing/rack.mp4',
  forest: '/landing/coffee.mp4',
}

const STYLE: Record<Ad['theme'], { bg: string; chip: string; chipInk: string; big: string }> = {
  sun: { bg: '#2a1a0c', chip: '#ffd60a', chipInk: '#141414', big: '#ffd60a' },
  cobalt: { bg: '#0d1424', chip: '#3d63ff', chipInk: '#ffffff', big: '#ffe14d' },
  self: { bg: '#050505', chip: '#34d399', chipInk: '#050505', big: '#34d399' },
  magenta: { bg: '#1a1014', chip: '#ff2d6f', chipInk: '#ffffff', big: '#ffffff' },
  forest: { bg: '#1a140f', chip: '#c6f36b', chipInk: '#0e4a35', big: '#c6f36b' },
}

const WIPE_MS = 380
const TEXT_IN_MS = 650
const TEXT_DUR_MS = 550
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

/** Largest font size (down to `min`) at which `text` fits in `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, min: number, maxWidth: number, family: string) {
  let s = size
  for (; s > min; s--) {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
  }
  ctx.font = `${weight} ${s}px ${family}`
  return s
}

function draw(
  ctx: CanvasRenderingContext2D,
  ad: Ad,
  video: HTMLVideoElement | undefined,
  elapsed: number,
  family: string,
) {
  const style = STYLE[ad.theme]
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  ctx.imageSmoothingQuality = 'high'
  ctx.globalAlpha = 1
  ctx.fillStyle = style.bg
  ctx.fillRect(0, 0, W, H)

  if (video && video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, W, H)
    // Darken the left side so the copy stays readable over any footage.
    const scrim = ctx.createLinearGradient(0, 0, 175, 0)
    scrim.addColorStop(0, 'rgba(0,0,0,0.78)')
    scrim.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, W, H)
  }

  // The copy arrives a beat after the footage, the way a real spot would cut.
  const p = ease((elapsed - TEXT_IN_MS) / TEXT_DUR_MS)
  const dx = Math.round((1 - p) * 10)
  const x = 12 + dx
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = p

  // Tag chip
  ctx.font = `700 7px ${family}`
  const chipW = Math.ceil(ctx.measureText(ad.tag).width) + 8
  ctx.fillStyle = style.chip
  ctx.beginPath()
  ctx.roundRect(x, 11, chipW, 11, 5.5)
  ctx.fill()
  ctx.fillStyle = style.chipInk
  ctx.fillText(ad.tag, x + 4, 19)

  // Brand, sized to leave room for the big number when there is one
  let bigWidth = 0
  if (ad.big) {
    ctx.font = `800 30px ${family}`
    bigWidth = ctx.measureText(ad.big).width
  }
  const brandMax = ad.big ? W - 12 - bigWidth - 10 - 12 : 206
  fit(ctx, ad.brand, 800, 22, 11, brandMax, family)
  ctx.fillStyle = ad.theme === 'self' ? style.big : '#ffffff'
  ctx.fillText(ad.brand, x, 45)

  // Blinking cursor on the house ad
  if (ad.theme === 'self' && Math.floor(elapsed / 530) % 2 === 0) {
    const w = ctx.measureText(ad.brand).width
    ctx.fillRect(x + w + 3, 29, 2, 18)
  }

  // Supporting line
  fit(ctx, ad.line, 600, 8, 6, 200, family)
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText(ad.line, x, 61)

  // Big number on the right
  if (ad.big) {
    ctx.globalAlpha = ease((elapsed - TEXT_IN_MS - 200) / TEXT_DUR_MS)
    ctx.font = `800 30px ${family}`
    ctx.textAlign = 'right'
    ctx.fillStyle = style.big
    ctx.fillText(ad.big, 228, 51)
    ctx.textAlign = 'left'
  }

  // LED-style wipe as a new ad takes the screen: columns light up left to right.
  ctx.globalAlpha = 1
  const wipe = ease(elapsed / WIPE_MS)
  if (wipe < 1) {
    const edge = Math.round(W * wipe)
    ctx.fillStyle = '#000'
    ctx.fillRect(edge, 0, W - edge, H)
  }
}

export default function LedCanvas({ ads, index, playing }: { ads: Ad[]; index: number; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const videos = useRef<Partial<Record<Ad['theme'], HTMLVideoElement | null>>>({})
  const ad = ads[index % ads.length]

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return

    // Read the page's real font faces (set by app/page.tsx) for the canvas text.
    const cs = getComputedStyle(el)
    const family = [cs.getPropertyValue('--lp-face-latin'), cs.getPropertyValue('--lp-face-georgian'), 'sans-serif']
      .map((f) => f.trim())
      .filter(Boolean)
      .join(', ')

    const video = videos.current[ad.theme] ?? undefined
    for (const v of Object.values(videos.current)) if (v && v !== video) v.pause()

    const start = performance.now()
    let raf = 0
    // Paused (off-screen or reduced motion): show the finished frame, no animation.
    const elapsedAt = (now: number) => (playing ? now - start : 60_000)
    const frame = (now: number) => {
      draw(ctx, ad, video, elapsedAt(now), family)
      if (playing) raf = requestAnimationFrame(frame)
    }

    const redraw = () => draw(ctx, ad, video, elapsedAt(performance.now()), family)
    if (video) {
      video.currentTime = 0
      if (playing) video.play().catch(() => {})
      else video.pause()
      video.addEventListener('loadeddata', redraw)
      video.addEventListener('seeked', redraw)
    }
    frame(start)

    return () => {
      cancelAnimationFrame(raf)
      video?.removeEventListener('loadeddata', redraw)
      video?.removeEventListener('seeked', redraw)
    }
  }, [ad, playing])

  return (
    <>
      <canvas ref={canvas} width={W * SCALE} height={H * SCALE} className="lp-led" aria-label={`${ad.tag} · ${ad.brand} · ${ad.line}`} role="img" />
      {(Object.keys(VIDEO) as Ad['theme'][]).map((theme) => (
        <video
          key={theme}
          ref={(v) => {
            videos.current[theme] = v
          }}
          className="lp-led-src"
          src={VIDEO[theme]}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          tabIndex={-1}
        />
      ))}
    </>
  )
}
