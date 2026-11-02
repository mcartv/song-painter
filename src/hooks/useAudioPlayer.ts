import { useEffect, useRef, useState } from 'react'

export function useAudioPlayer() {
    const audioRef = useRef<HTMLAudioElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
    const urlRef = useRef<string | null>(null)

    const [song, setSong] = useState<string | null>(null)
    const [playing, setPlaying] = useState(false)
    const [current, setCurrent] = useState(0)
    const [duration, setDuration] = useState(0)
    const [error, setError] = useState('')

    useEffect(() => {
        return () => {
            const audio = audioRef.current
            audio?.pause()
            sourceRef.current?.disconnect()
            analyserRef.current?.disconnect()
            if (urlRef.current) URL.revokeObjectURL(urlRef.current)
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                void audioContextRef.current.close()
            }
        }
    }, [])

    const loadFile = (file?: File) => {
        if (!file) return
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
        if (!isAudio) {
            setError('Choose a supported audio file.')
            return
        }
        const audio = audioRef.current
        if (!audio) return
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = URL.createObjectURL(file)
        audio.src = urlRef.current
        audio.load()
        setSong(file.name.replace(/\.[^/.]+$/, ''))
        setCurrent(0)
        setDuration(0)
        setPlaying(false)
        setError('')
        if (inputRef.current) inputRef.current.value = ''
    }

    const togglePlayback = async () => {
        const audio = audioRef.current
        if (!audio) return
        if (!song) {
            inputRef.current?.click()
            return
        }
        try {
            if (!audio.paused) {
                audio.pause()
                setPlaying(false)
                return
            }
            if (!audioContextRef.current) {
                const context = new AudioContext()
                const analyser = context.createAnalyser()
                analyser.fftSize = 512
                const source = context.createMediaElementSource(audio)
                source.connect(analyser)
                analyser.connect(context.destination)
                audioContextRef.current = context
                analyserRef.current = analyser
                sourceRef.current = source
            }
            await audioContextRef.current.resume()
            await audio.play()
            setPlaying(true)
            setError('')
        } catch {
            setPlaying(false)
            setError('This audio could not be played in your browser. Try a different file.')
        }
    }

    const removeSong = () => {
        const audio = audioRef.current
        if (audio) {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
        }
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current)
            urlRef.current = null
        }
        if (inputRef.current) inputRef.current.value = ''
        setSong(null)
        setPlaying(false)
        setCurrent(0)
        setDuration(0)
        setError('')
    }

    const seek = (time: number) => {
        const audio = audioRef.current
        if (!audio || duration <= 0 || !Number.isFinite(time)) return
        audio.currentTime = Math.max(0, Math.min(time, duration))
        setCurrent(audio.currentTime)
    }

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrent(audioRef.current.currentTime)
    }
    const handleLoadedMetadata = () => {
        const value = audioRef.current?.duration ?? 0
        setDuration(Number.isFinite(value) ? value : 0)
    }
    const handleEnded = () => setPlaying(false)
    const handleAudioError = () => {
        if (urlRef.current) {
            setPlaying(false)
            setError('This audio file cannot be decoded in this browser.')
        }
    }

    return {
        audioRef, inputRef, analyserRef,
        song, playing, current, duration, error,
        loadFile, togglePlayback, removeSong, seek,
        handleTimeUpdate, handleLoadedMetadata,
        handleEnded, handleAudioError,
    }
}
