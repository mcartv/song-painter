import { useRef, useState } from 'react'
import { ArrowDownToLine, Image, Music2, Pause, Play, SlidersHorizontal, UploadCloud, Volume2, X } from 'lucide-react'

import type { PaintingStyle } from './types/studio'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import Header from './components/layout/Header'
import AboutModal from './components/ui/AboutModal'
import StyleSelector from './components/studio/StyleSelector'
import PaintingControls from './components/studio/PaintingControls'
import PaintingCanvas from './components/studio/PaintingCanvas'

const formatTime = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [style, setStyle] = useState<PaintingStyle>('Bloom')
  const [palette, setPalette] = useState(0)
  const [intensity, setIntensity] = useState(65)
  const [density, setDensity] = useState(65)
  const {
    audioRef,
    inputRef,
    analyserRef,
    song,
    playing,
    current,
    duration,
    error,
    loadFile,
    togglePlayback,
    removeSong,
    seek,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleEnded,
    handleAudioError,
  } = useAudioPlayer()
  const [help, setHelp] = useState(false)

  const exportImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a'); link.download = 'song-painter-artwork.png'; link.href = canvas.toDataURL('image/png'); link.click()
  }
  return (
    <div className="app-shell">
      <Header onAboutClick={() => setHelp(true)} />
      <main className="workspace">
        <div className="workspace-heading"><div><span className="eyebrow"><span className="live-dot" /> YOUR CREATIVE SPACE</span><h1>Make sound <em>visible.</em></h1><p>Let the music move the colors. See where it takes you.</p></div><button className="export-button" onClick={exportImage}><ArrowDownToLine size={17} /> Export artwork</button></div>
        <div className="studio-grid">
          <PaintingCanvas
            canvasRef={canvasRef}
            analyserRef={analyserRef}
            song={song}
            playing={playing}
            style={style}
            palette={palette}
            intensity={intensity}
            density={density}
          />
          <aside className="controls-panel">
            <div className="panel-header"><span className="section-number">01</span><div><h2>Your music</h2><p>Start with a sound you love.</p></div></div>
            <input ref={inputRef} className="visually-hidden" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={e => loadFile(e.target.files?.[0])} />
            <button className="upload-zone" onClick={() => inputRef.current?.click()}><span className="upload-icon"><UploadCloud size={23} /></span><strong>{song ? 'Change your song' : 'Drop into the rhythm'}</strong><span>{song ? 'Choose another audio file' : 'Click to upload an audio file'}</span><small>MP3, WAV, OGG & browser-supported formats</small></button>
            {song && <div className="track"><div className="track-art"><Music2 size={21} /></div><div className="track-info"><strong title={song}>{song}</strong><span>Local audio file</span></div><button onClick={removeSong} aria-label="Remove song"><X size={16} /></button></div>}
            <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} onError={handleAudioError} />
            <div className="player"><button className="play" onClick={togglePlayback} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause fill="currentColor" size={18} /> : <Play fill="currentColor" size={18} />}</button><div className="seek"><input aria-label="Song position" type="range" min={0} max={duration || 1} value={current} onChange={e => seek(Number(e.target.value))} /><div className="timing"><span>{formatTime(current)}</span><span>{formatTime(duration)}</span></div></div><Volume2 size={18} className="speaker" /></div>
            {error && <div className="error" role="alert">{error}</div>}
            <div className="panel-divider" />

            <StyleSelector
              selectedStyle={style}
              onStyleChange={setStyle}
            />

            <PaintingControls
              palette={palette}
              intensity={intensity}
              density={density}
              onPaletteChange={setPalette}
              onIntensityChange={setIntensity}
              onDensityChange={setDensity}
              onReset={() => {
                setStyle('Bloom')
                setPalette(0)
                setIntensity(65)
                setDensity(65)
              }}
            />
          </aside>
        </div>
        <footer className="footer"><span><span className="brand-dot">✦</span> An experiment in listening differently.</span><span><SlidersHorizontal size={13} /> PHASE 01 / CREATIVE STUDIO <Image size={13} /></span></footer>
      </main>
      {help && <AboutModal onClose={() => setHelp(false)} />}
    </div>
  )
}
