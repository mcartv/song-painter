import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, AudioLines, CircleHelp, Image, Music2, Pause, Play, RotateCcw, SlidersHorizontal, Sparkles, UploadCloud, Volume2, X } from 'lucide-react'

type Style = 'Bloom' | 'Flow' | 'Pulse'
const palettes = [
  { name: 'Aurora', colors: ['#bd9cff', '#ff92b0', '#76d9d0'] },
  { name: 'Sunset', colors: ['#ff9a75', '#f76e97', '#f8d480'] },
  { name: 'Ocean', colors: ['#66b9e8', '#4e88e8', '#8fdfd8'] },
  { name: 'Mono', colors: ['#eeeeef', '#a6a1b1', '#646171'] },
]
const formatTime = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const urlRef = useRef<string | null>(null)
  const [style, setStyle] = useState<Style>('Bloom')
  const [palette, setPalette] = useState(0)
  const [intensity, setIntensity] = useState(65)
  const [density, setDensity] = useState(65)
  const [song, setSong] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const [help, setHelp] = useState(false)
  const configRef = useRef({ style, palette, intensity, density, playing })
  useEffect(() => { configRef.current = { style, palette, intensity, density, playing } }, [style, palette, intensity, density, playing])

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
        energy = bins.slice(0, 130).reduce((a, b) => a + b, 0) / (130 * 255)
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

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); void ctxRef.current?.close() }, [])

  const loadFile = (file?: File) => {
    if (!file) return
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
    if (!isAudio) { setError('Choose a supported audio file.'); return }
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(file)
    audio.src = urlRef.current
    audio.load()
    setSong(file.name.replace(/\.[^/.]+$/, ''))
    setCurrent(0); setDuration(0); setPlaying(false); setError('')
  }
  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!song) { inputRef.current?.click(); return }
    try {
      if (audio.paused) {
        if (!ctxRef.current) {
          ctxRef.current = new AudioContext()
          analyserRef.current = ctxRef.current.createAnalyser()
          analyserRef.current.fftSize = 512
          sourceRef.current = ctxRef.current.createMediaElementSource(audio)
          sourceRef.current.connect(analyserRef.current)
          analyserRef.current.connect(ctxRef.current.destination)
        }
        await ctxRef.current.resume()
        await audio.play()
        setPlaying(true)
      } else { audio.pause(); setPlaying(false) }
    } catch { setError('This audio could not be played in your browser. Try a different file.') }
  }
  const exportImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a'); link.download = 'song-painter-artwork.png'; link.href = canvas.toDataURL('image/png'); link.click()
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon"><AudioLines size={21}/></span><span>song<span className="brand-accent">painter</span><span className="brand-dot">.</span></span></div>
        <nav className="top-nav"><span className="active-link">Studio</span><span className="quiet-link">A little space for sound & color</span></nav>
        <button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/><span>About</span></button>
      </header>
      <main className="workspace">
        <div className="workspace-heading"><div><span className="eyebrow"><span className="live-dot"/> YOUR CREATIVE SPACE</span><h1>Make sound <em>visible.</em></h1><p>Let the music move the colors. See where it takes you.</p></div><button className="export-button" onClick={exportImage}><ArrowDownToLine size={17}/> Export artwork</button></div>
        <div className="studio-grid">
          <section className="canvas-panel">
            <div className="canvas-top"><span><span className="tiny-square"/> LIVE CANVAS</span><span className="canvas-state"><span className="state-circle"/> {playing ? 'REACTIVE' : 'READY TO CREATE'}</span></div>
            <div className="canvas-wrap"><canvas ref={canvasRef} aria-label="Generative audio reactive visual canvas"/><div className="canvas-overlay"><span className="canvas-ornament">✦</span><span>{song ? 'PAINTING IN PROGRESS' : 'YOUR CANVAS AWAITS'}</span></div></div>
            <div className="canvas-footer"><span><Sparkles size={14}/> Every song leaves a different trace.</span><span>1920 × your imagination</span></div>
          </section>
          <aside className="controls-panel">
            <div className="panel-header"><span className="section-number">01</span><div><h2>Your music</h2><p>Start with a sound you love.</p></div></div>
            <input ref={inputRef} className="visually-hidden" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={e => loadFile(e.target.files?.[0])}/>
            <button className="upload-zone" onClick={() => inputRef.current?.click()}><span className="upload-icon"><UploadCloud size={23}/></span><strong>{song ? 'Change your song' : 'Drop into the rhythm'}</strong><span>{song ? 'Choose another audio file' : 'Click to upload an audio file'}</span><small>MP3, WAV, OGG & browser-supported formats</small></button>
            {song && <div className="track"><div className="track-art"><Music2 size={21}/></div><div className="track-info"><strong title={song}>{song}</strong><span>Local audio file</span></div><button onClick={() => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.src = ''; setSong(null); setPlaying(false); }} aria-label="Remove song"><X size={16}/></button></div>}
            <audio ref={audioRef} onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)} onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onEnded={() => setPlaying(false)} onError={() => { if (song) setError('This audio file cannot be decoded in this browser.') }}/>
            <div className="player"><button className="play" onClick={togglePlayback} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause fill="currentColor" size={18}/> : <Play fill="currentColor" size={18}/>}</button><div className="seek"><input aria-label="Song position" type="range" min={0} max={duration || 1} value={current} onChange={e => { if (audioRef.current && duration) audioRef.current.currentTime = Number(e.target.value)}}/><div className="timing"><span>{formatTime(current)}</span><span>{formatTime(duration)}</span></div></div><Volume2 size={18} className="speaker"/></div>
            {error && <div className="error" role="alert">{error}</div>}
            <div className="panel-divider"/>
            <div className="panel-header"><span className="section-number">02</span><div><h2>Painting style</h2><p>Choose your kind of magic.</p></div></div>
            <div className="styles">{(['Bloom','Flow','Pulse'] as Style[]).map((name,i) => <button key={name} onClick={() => setStyle(name)} className={`style-choice ${style === name ? 'selected' : ''}`}><span className={`style-preview preview-${i}`}>{i===0 ? '✺' : i===1 ? '〰' : '◎'}</span><span>{name}</span></button>)}</div>
            <div className="control-title"><span>Color palette</span><span className="muted-value">{palettes[palette].name}</span></div>
            <div className="palette-choices">{palettes.map((item,i) => <button title={item.name} aria-label={item.name} aria-pressed={palette===i} key={item.name} className={`palette-choice ${palette === i ? 'chosen' : ''}`} onClick={() => setPalette(i)} style={{background:`linear-gradient(120deg, ${item.colors.join(', ')})`}}/>)}</div>
            <div className="control-title"><span>Intensity</span><span className="muted-value">{intensity}%</span></div><input className="setting-range" aria-label="Intensity" type="range" min="10" max="100" value={intensity} onChange={e=>setIntensity(Number(e.target.value))}/>
            <div className="control-title"><span>Particle density</span><span className="muted-value">{density}%</span></div><input className="setting-range" aria-label="Particle density" type="range" min="10" max="100" value={density} onChange={e=>setDensity(Number(e.target.value))}/>
            <button className="reset" onClick={()=>{setStyle('Bloom');setPalette(0);setIntensity(65);setDensity(65)}}><RotateCcw size={14}/> Reset settings</button>
          </aside>
        </div>
        <footer className="footer"><span><span className="brand-dot">✦</span> An experiment in listening differently.</span><span><SlidersHorizontal size={13}/> PHASE 01 / CREATIVE STUDIO <Image size={13}/></span></footer>
      </main>
      {help && <div className="modal-backdrop" onMouseDown={()=>setHelp(false)}><div role="dialog" aria-modal="true" aria-labelledby="about-title" className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={()=>setHelp(false)}><X size={18}/></button><span className="eyebrow">A NOTE ABOUT THIS PROJECT</span><h2 id="about-title">Listen with your eyes.</h2><p>Song Painter is a small creative studio that translates music into glowing generative artwork. Upload an audio file, press play, and experiment with color and movement.</p><p>Files stay in your browser. This is an early frontend prototype; more painting tools and better audio mapping are coming later.</p><button className="modal-action" onClick={()=>setHelp(false)}>Back to studio</button></div></div>}
    </div>
  )
}
