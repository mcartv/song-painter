
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { Download, Eraser, Paintbrush, RotateCcw, Sparkles, Trash2 } from 'lucide-react'

import type { PaintingStyle } from '../../types/studio'
import type { AudioFeatures } from '../../lib/audioAnalyzer'
import type {
  BrushMode,
  BrushPoint,
  BrushStroke,
  BrushPreset,
} from '../../types/brush'


import { analyzeAudio, SILENT_AUDIO } from '../../lib/audioAnalyzer'
import { renderPainting } from '../../lib/paintingEngine'
import { drawBrushStroke } from '../../lib/brushEngine'
import { palettes } from '../../lib/palettes'
import { exportArtwork } from '../../lib/exportArtwork'

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
  const [brushSize, setBrushSize] = useState(12)
  const [brushMode, setBrushMode] = useState<BrushMode>('paint')
  const [brushPreset, setBrushPreset] = useState<BrushPreset>('glow')
  const [strokeCount, setStrokeCount] = useState(0)
  const [cursor, setCursor] = useState<{
    x: number
    y: number
  } | null>(null)


  const configRef = useRef({
    style, palette, intensity, density, playing,
  })


  const brushRef = useRef({
    brushSize,
    brushMode,
    brushPreset,
  })
  const strokesRef = useRef<BrushStroke[]>([])
  const activeStrokeRef = useRef<BrushStroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const nextStrokeIdRef = useRef(1)
  const audioFeaturesRef = useRef<AudioFeatures>({ ...SILENT_AUDIO })

  const lastFrameRef = useRef(0)
  const paintLayerRef = useRef<HTMLCanvasElement | null>(null)
  const paintDirtyRef = useRef(true)
  const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 })

  useEffect(() => {
    configRef.current = {
      style,
      palette,
      intensity,
      density,
      playing,
    }
  }, [style, palette, intensity, density, playing])

  useEffect(() => {
    brushRef.current = {
      brushSize,
      brushMode,
      brushPreset,
    }
  }, [brushSize, brushMode, brushPreset])


  const getPoint = (event: PointerEvent<HTMLCanvasElement>): BrushPoint => {
    const rect = event.currentTarget.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pointerType === 'mouse' ? 1 : event.pressure || 0.5,
    }
  }


  const updateCursor = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    const point = getPoint(event)

    setCursor({
      x: point.x,
      y: point.y,
    })
  }


  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const config = configRef.current
    const brush = brushRef.current
    const audio = audioFeaturesRef.current
    const colors = palettes[config.palette].colors

    const boost = config.playing
      ? 1 + audio.bass * 1.5 + audio.energy * 0.5
      : 1

    const stroke: BrushStroke = {
      id: nextStrokeIdRef.current++,
      points: [getPoint(event)],
      color: colors[(nextStrokeIdRef.current - 2) % colors.length],
      size: brush.brushSize * boost,
      opacity: 0.85,
      mode: brush.brushMode,
      preset: brush.brushPreset,
    }


    activeStrokeRef.current = stroke
    activePointerRef.current = event.pointerId
    paintDirtyRef.current = true

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (
      activePointerRef.current !== event.pointerId ||
      !activeStrokeRef.current
    ) return

    const stroke = activeStrokeRef.current
    const point = getPoint(event)
    const last = stroke.points[stroke.points.length - 1]

    if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return

    if (stroke.points.length < 3000) {
      stroke.points.push(point)
      paintDirtyRef.current = true
    }
  }

  const finishStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return

    if (activeStrokeRef.current) {
      strokesRef.current.push(activeStrokeRef.current)

      if (strokesRef.current.length > 100) {
        strokesRef.current.shift()
      }
    }

    activeStrokeRef.current = null
    activePointerRef.current = null
    paintDirtyRef.current = true
    setStrokeCount(strokesRef.current.length)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const undoStroke = () => {
    if (activePointerRef.current !== null) return
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
    paintDirtyRef.current = true
  }

  const clearStrokes = () => {
    if (activePointerRef.current !== null) return
    strokesRef.current = []
    setStrokeCount(0)
    paintDirtyRef.current = true
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const paintLayer = document.createElement('canvas')
    const paintCtx = paintLayer.getContext('2d')
    if (!paintCtx) return

    paintLayerRef.current = paintLayer

    let animation = 0
    let frame = 0
    let lastTime = 0
    let frequencyData: Uint8Array<ArrayBuffer> | null = null
    let smoothed: AudioFeatures = { ...SILENT_AUDIO }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)


      const previous = canvasSizeRef.current

      if (
        previous.width > 0 &&
        previous.height > 0 &&
        (previous.width !== rect.width ||
          previous.height !== rect.height)
      ) {
        const scaleX = rect.width / previous.width
        const scaleY = rect.height / previous.height

        const resizeStroke = (stroke: BrushStroke) => {
          for (const point of stroke.points) {
            point.x *= scaleX
            point.y *= scaleY
          }
        }

        for (const stroke of strokesRef.current) {
          resizeStroke(stroke)
        }

        if (activeStrokeRef.current) {
          resizeStroke(activeStrokeRef.current)
        }
      }

      canvasSizeRef.current = {
        width: rect.width,
        height: rect.height,
        dpr,
      }

      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)

      paintLayer.width = canvas.width
      paintLayer.height = canvas.height

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintDirtyRef.current = true
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = (timestamp: number) => {
      const config = configRef.current
      const { width, height } = canvasSizeRef.current

      const delta = lastTime
        ? Math.min((timestamp - lastTime) / 16.667, 3)
        : 1

      lastTime = timestamp
      if (config.playing) frame += delta

      const analyser = analyserRef.current
      let features = SILENT_AUDIO

      if (analyser && config.playing) {
        if (
          !frequencyData ||
          frequencyData.length !== analyser.frequencyBinCount
        ) {
          frequencyData = new Uint8Array(analyser.frequencyBinCount)
        }

        features = analyzeAudio(analyser, frequencyData)
      }

      const smoothing = 1 - Math.pow(0.82, delta)

      smoothed = {
        bass: smoothed.bass + (features.bass - smoothed.bass) * smoothing,
        mid: smoothed.mid + (features.mid - smoothed.mid) * smoothing,
        treble: smoothed.treble + (features.treble - smoothed.treble) * smoothing,
        energy: smoothed.energy + (features.energy - smoothed.energy) * smoothing,
      }

      audioFeaturesRef.current = smoothed

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#111016'
      ctx.fillRect(0, 0, width, height)

      const bg = ctx.createRadialGradient(
        width * 0.5, height * 0.48, 2,
        width * 0.5, height * 0.48,
        Math.max(width, height) * 0.57,
      )

      bg.addColorStop(0, '#262131')
      bg.addColorStop(0.6, '#17151f')
      bg.addColorStop(1, '#111016')

      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      renderPainting(config.style, {
        ctx,
        width,
        height,
        frame,
        colors: palettes[config.palette].colors,
        count: Math.round(85 + config.density * 2.5),
        intensity: config.intensity,
        playing: config.playing,
        audio: smoothed,
      })

      // Rebuild the transparent painting layer only when needed.
      if (paintDirtyRef.current) {
        paintCtx.clearRect(0, 0, width, height)

        for (const stroke of strokesRef.current) {
          drawBrushStroke(paintCtx, stroke)
        }

        if (activeStrokeRef.current) {
          drawBrushStroke(paintCtx, activeStrokeRef.current)
        }

        paintDirtyRef.current = false
      }

      ctx.drawImage(paintLayer, 0, 0, width, height)
      lastFrameRef.current = frame
      animation = requestAnimationFrame(render)
    }

    animation = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
      paintLayerRef.current = null
    }
  }, [canvasRef, analyserRef])

  const saveHD = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const config = configRef.current

    exportArtwork({
      width: rect.width,
      height: rect.height,
      scale: 2,
      style: config.style,
      palette: config.palette,
      intensity: config.intensity,
      density: config.density,
      playing: config.playing,
      frame: lastFrameRef.current,
      audio: audioFeaturesRef.current,
      strokes: [
        ...strokesRef.current,
        ...(activeStrokeRef.current
          ? [activeStrokeRef.current]
          : []),
      ],
    })
  }

  const toolButton = (selected: boolean) => ({
    border: '1px solid rgba(180, 166, 201, 0.28)',
    background: selected ? 'rgba(180, 142, 231, 0.23)' : 'transparent',
    color: 'inherit',
    borderRadius: 10,
    padding: '8px 12px',
    display: 'inline-flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    cursor: 'pointer',
    fontSize: 12,
  })

  return (
    <section className="canvas-panel">
      <div className="canvas-top">
        <span>
          <span className="tiny-square" /> LIVE CANVAS
        </span>
        <span className="canvas-state">
          <span className="state-circle" />
          {playing ? 'REACTIVE' : 'READY TO CREATE'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(180, 166, 201, 0.15)',
        }}
      >
        <button
          type="button"
          aria-label="Paint brush"
          aria-pressed={brushMode === 'paint'}
          onClick={() => setBrushMode('paint')}
          style={toolButton(brushMode === 'paint')}
        >
          <Paintbrush size={15} /> Brush
        </button>

        <button
          type="button"
          aria-label="Eraser"
          aria-pressed={brushMode === 'erase'}
          onClick={() => setBrushMode('erase')}
          style={toolButton(brushMode === 'erase')}
        >
          <Eraser size={15} /> Eraser
        </button>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          Preset
          <select
            aria-label="Brush preset"
            value={brushPreset}
            onChange={(event) =>
              setBrushPreset(event.target.value as BrushPreset)
            }
            disabled={brushMode === 'erase'}
            style={{
              border: '1px solid rgba(180,166,201,0.28)',
              borderRadius: 10,
              background: '#211c2b',
              color: '#f1e9fa',
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            <option value="glow">Soft Glow</option>
            <option value="ink">Ink</option>
            <option value="particles">Particles</option>
          </select>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          Size
          <input
            aria-label="Brush size"
            type="range"
            min={2}
            max={48}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: 95, accentColor: '#b58bdf' }}
          />
          <span style={{ minWidth: 30 }}>{brushSize}px</span>
        </label>

        <button
          type="button"
          onClick={undoStroke}
          disabled={strokeCount === 0}
          style={toolButton(false)}
        >
          <RotateCcw size={15} /> Undo
        </button>

        <button
          type="button"
          onClick={clearStrokes}
          disabled={strokeCount === 0}
          style={toolButton(false)}
        >
          <Trash2 size={15} /> Clear
        </button>

        <button
          type="button"
          onClick={saveHD}
          style={toolButton(false)}
          title="Export high-resolution PNG"
        >
          <Download size={15} />
          Save HD
        </button>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label="Interactive audio reactive painting canvas"
          style={{
            touchAction: 'none',
            cursor: brushMode === 'erase' ? 'cell' : 'crosshair',
          }}

          onPointerDown={(event) => {
            updateCursor(event)
            handlePointerDown(event)
          }}
          onPointerMove={(event) => {
            updateCursor(event)
            handlePointerMove(event)
          }}
          onPointerEnter={updateCursor}
          onPointerLeave={() => setCursor(null)}

          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />


        {cursor && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: cursor.x,
              top: cursor.y,
              width: brushSize,
              height: brushSize,
              border: `1.5px solid ${brushMode === 'erase'
                ? '#f5a5a5'
                : '#d9b8ff'
                }`,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 5,
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.35), 0 0 12px rgba(190,150,240,0.2)',
            }}
          />
        )}

        <div
          className="canvas-overlay"
          style={{ pointerEvents: 'none' }}
        >
          <span className="canvas-ornament">✦</span>
          <span>
            {song ? 'PAINTING IN PROGRESS' : 'YOUR CANVAS AWAITS'}
          </span>
        </div>
      </div>

      <div className="canvas-footer">
        <span>
          <Sparkles size={14} /> Draw along with your music.
        </span>
        <span>{strokeCount} STROKES</span>
      </div>
    </section>
  )
}
