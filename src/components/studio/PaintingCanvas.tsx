
import { useEffect, useRef } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { Sparkles } from 'lucide-react'

import type { PaintingStyle } from '../../types/studio'
import type { AudioFeatures } from '../../lib/audioAnalyzer'
import type { BrushPoint, BrushStroke } from '../../types/brush'

import {
  analyzeAudio,
  SILENT_AUDIO,
} from '../../lib/audioAnalyzer'

import { renderPainting } from '../../lib/paintingEngine'
import { drawBrushStroke } from '../../lib/brushEngine'
import { palettes } from '../../lib/palettes'

interface PaintingCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  analyserRef: RefObject<AnalyserNode | null>
  song: string | null
  playing: boolean
  style: PaintingStyle
  palette: number
  intensity: number
  density: number
}

export default function PaintingCanvas({
  canvasRef,
  analyserRef,
  song,
  playing,
  style,
  palette,
  intensity,
  density,
}: PaintingCanvasProps) {
  const configRef = useRef({
    style,
    palette,
    intensity,
    density,
    playing,
  })

  const strokesRef = useRef<BrushStroke[]>([])
  const activeStrokeRef = useRef<BrushStroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const nextStrokeIdRef = useRef(1)
  const audioFeaturesRef = useRef<AudioFeatures>({
    ...SILENT_AUDIO,
  })

  useEffect(() => {
    configRef.current = {
      style,
      palette,
      intensity,
      density,
      playing,
    }
  }, [style, palette, intensity, density, playing])

  // Convert pointer coordinates into canvas CSS coordinates.
  const getPoint = (
    event: PointerEvent<HTMLCanvasElement>,
  ): BrushPoint => {
    const rect = event.currentTarget.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure:
        event.pointerType === 'mouse'
          ? 1
          : event.pressure || 0.5,
    }
  }

  const handlePointerDown = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (activePointerRef.current !== null) return

    if (
      event.pointerType === 'mouse' &&
      event.button !== 0
    ) {
      return
    }

    const point = getPoint(event)
    const config = configRef.current
    const audio = audioFeaturesRef.current

    const colors = palettes[config.palette].colors
    const color = colors[
      (nextStrokeIdRef.current - 1) % colors.length
    ]

    // Music influences brush thickness.
    const audioBoost = config.playing
      ? 1 + audio.bass * 2 + audio.energy
      : 1

    const stroke: BrushStroke = {
      id: nextStrokeIdRef.current++,
      points: [point],
      color,
      size:
        (3 + config.intensity * 0.12) *
        audioBoost,
      opacity: 0.85,
    }

    activeStrokeRef.current = stroke
    activePointerRef.current = event.pointerId

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (
      activePointerRef.current !== event.pointerId ||
      !activeStrokeRef.current
    ) {
      return
    }

    const point = getPoint(event)
    const stroke = activeStrokeRef.current

    const last = stroke.points[stroke.points.length - 1]

    const distance = Math.hypot(
      point.x - last.x,
      point.y - last.y,
    )

    if (distance < 1) return

    // Prevent excessively large strokes.
    if (stroke.points.length < 3000) {
      stroke.points.push(point)
    }
  }

  const finishStroke = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (activePointerRef.current !== event.pointerId) {
      return
    }

    const stroke = activeStrokeRef.current

    if (stroke) {
      strokesRef.current.push(stroke)

      // Limit the amount of stored painting history.
      if (strokesRef.current.length > 100) {
        strokesRef.current.shift()
      }
    }

    activeStrokeRef.current = null
    activePointerRef.current = null

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      )
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animation = 0
    let frame = 0
    let width = 0
    let height = 0
    let lastTime = 0

    let frequencyData: Uint8Array<ArrayBuffer> | null = null

    let smoothed: AudioFeatures = {
      ...SILENT_AUDIO,
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
      )

      width = rect.width
      height = rect.height

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = (timestamp: number) => {
      const config = configRef.current

      const delta = lastTime
        ? Math.min((timestamp - lastTime) / 16.667, 3)
        : 1

      lastTime = timestamp

      if (config.playing) {
        frame += delta
      }

      const analyser = analyserRef.current
      let features = SILENT_AUDIO

      if (analyser && config.playing) {
        if (
          !frequencyData ||
          frequencyData.length !== analyser.frequencyBinCount
        ) {
          frequencyData = new Uint8Array(
            analyser.frequencyBinCount,
          )
        }

        features = analyzeAudio(
          analyser,
          frequencyData,
        )
      }

      const smoothing = 1 - Math.pow(0.82, delta)

      smoothed = {
        bass:
          smoothed.bass +
          (features.bass - smoothed.bass) * smoothing,

        mid:
          smoothed.mid +
          (features.mid - smoothed.mid) * smoothing,

        treble:
          smoothed.treble +
          (features.treble - smoothed.treble) * smoothing,

        energy:
          smoothed.energy +
          (features.energy - smoothed.energy) * smoothing,
      }

      audioFeaturesRef.current = smoothed

      // Draw background.
      ctx.clearRect(0, 0, width, height)

      ctx.fillStyle = '#111016'
      ctx.fillRect(0, 0, width, height)

      const background = ctx.createRadialGradient(
        width * 0.5,
        height * 0.48,
        2,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.57,
      )

      background.addColorStop(0, '#262131')
      background.addColorStop(0.6, '#17151f')
      background.addColorStop(1, '#111016')

      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)

      // Draw the existing music visualizer.
      renderPainting(config.style, {
        ctx,
        width,
        height,
        frame,
        colors: palettes[config.palette].colors,
        count: Math.round(
          85 + config.density * 2.5,
        ),
        intensity: config.intensity,
        playing: config.playing,
        audio: smoothed,
      })

      // Draw saved brush strokes over the visualizer.
      for (const stroke of strokesRef.current) {
        drawBrushStroke(ctx, stroke)
      }

      // Render the stroke currently being drawn.
      if (activeStrokeRef.current) {
        drawBrushStroke(
          ctx,
          activeStrokeRef.current,
        )
      }

      animation = requestAnimationFrame(render)
    }

    animation = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
    }
  }, [canvasRef, analyserRef])

  return (
    <section className="canvas-panel">
      <div className="canvas-top">
        <span>
          <span className="tiny-square" />
          LIVE CANVAS
        </span>

        <span className="canvas-state">
          <span className="state-circle" />
          {playing
            ? 'REACTIVE'
            : 'READY TO CREATE'}
        </span>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label="Interactive audio reactive painting canvas"
          style={{
            touchAction: 'none',
            cursor: 'crosshair',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />

        <div
          className="canvas-overlay"
          style={{ pointerEvents: 'none' }}
        >
          <span className="canvas-ornament">✦</span>

          <span>
            {song
              ? 'PAINTING IN PROGRESS'
              : 'YOUR CANVAS AWAITS'}
          </span>
        </div>
      </div>

      <div className="canvas-footer">
        <span>
          <Sparkles size={14} />
          Draw along with your music.
        </span>

        <span>YOUR INTERACTIVE CANVAS</span>
      </div>
    </section>
  )
}
