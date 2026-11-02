import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { Sparkles } from 'lucide-react'
import type { PaintingStyle } from '../../types/studio'
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
  // Keep the animation loop stable while providing it with fresh settings.
  const configRef = useRef({ style, palette, intensity, density, playing })
  useEffect(() => {
    configRef.current = { style, palette, intensity, density, playing }
  }, [style, palette, intensity, density, playing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let frame = 0
    let animation = 0
    let w = 0
    let h = 0
    let dpr = 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width; h = rect.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    const render = () => {
      const config = configRef.current
      const colors = palettes[config.palette].colors
      frame += config.playing ? 1 : 0.25
      context.clearRect(0, 0, w, h)
      context.fillStyle = '#111016'
      context.fillRect(0, 0, w, h)
      const bg = context.createRadialGradient(w * .5, h * .48, 2, w * .5, h * .48, Math.max(w, h) * .57)
      bg.addColorStop(0, '#262131'); bg.addColorStop(.6, '#17151f'); bg.addColorStop(1, '#111016')
      context.fillStyle = bg; context.fillRect(0, 0, w, h)
      let energy = 0.24
      if (analyserRef.current && config.playing) {
        const bins = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(bins)
        const sampleCount = Math.min(130, bins.length)
        energy = bins.slice(0, sampleCount).reduce((a, b) => a + b, 0) / (sampleCount * 255)
      }
      const power = .6 + energy * (config.intensity / 45)
      const count = Math.round(85 + config.density * 2.5)
      context.globalCompositeOperation = 'screen'
      for (let i = 0; i < count; i++) {
        const seed = i * 2.399963229728653
        const orbit = Math.sqrt((i + .5) / count)
        const t = frame * .006 + seed
        const a = seed * 2.1 + frame * .002 * ((i % 3) - 1)
        const spread = Math.min(w, h) * (.09 + orbit * .32 * power)
        const x = w * .5 + Math.cos(a) * spread + Math.sin(t) * 16
        const y = h * .5 + Math.sin(a) * spread * .66 + Math.cos(t * 1.2) * 22
        const hue = colors[i % colors.length]
        context.globalAlpha = (.1 + (1 - orbit) * .47) * (config.playing ? 1 : .68)
        if (config.style === 'Flow') {
          context.beginPath(); context.strokeStyle = hue; context.lineWidth = 1 + (i % 5) * .5
          context.moveTo(x, y); context.bezierCurveTo(x + 35, y - 30, x - 24, y - 45, x + Math.sin(t) * 50, y - 50); context.stroke()
        } else if (config.style === 'Pulse') {
          context.beginPath(); context.strokeStyle = hue; context.lineWidth = 1.2
          context.arc(w * .5, h * .5, orbit * Math.min(w, h) * .36 * power + Math.sin(t) * 6, 0, Math.PI * 2); context.stroke()
        } else {
          const radius = (1.5 + (i % 9) * .72) * power
          context.fillStyle = hue; context.shadowBlur = 13; context.shadowColor = hue
          context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill()
          context.shadowBlur = 0
        }
      }
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      animation = requestAnimationFrame(render)
    }
    render()
    return () => { cancelAnimationFrame(animation); observer.disconnect() }
  }, [])


  return (
    <section className="canvas-panel">
      <div className="canvas-top">
        <span><span className="tiny-square" /> LIVE CANVAS</span>
        <span className="canvas-state">
          <span className="state-circle" /> {playing ? 'REACTIVE' : 'READY TO CREATE'}
        </span>
      </div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} aria-label="Generative audio reactive visual canvas" />
        <div className="canvas-overlay">
          <span className="canvas-ornament">✦</span>
          <span>{song ? 'PAINTING IN PROGRESS' : 'YOUR CANVAS AWAITS'}</span>
        </div>
      </div>
      <div className="canvas-footer">
        <span><Sparkles size={14} /> Every song leaves a different trace.</span>
        <span>1920 × your imagination</span>
      </div>
    </section>
  )
}
