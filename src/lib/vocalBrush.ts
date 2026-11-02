import type { AudioFeatures } from './audioAnalyzer'
import type { BrushStroke } from '../types/brush'

export interface VocalBrushState {
    active: BrushStroke | null
    heldSince: number | null
    quietSince: number | null
    x: number
    y: number
    targetX: number
    targetY: number
    nextTargetAt: number
    nextId: number
}

export interface VocalBrushResult {
    changed: boolean
    finished: BrushStroke | null
}

const randomBetween = (min: number, max: number) =>
    min + Math.random() * (max - min)

export function createVocalBrushState(
    width: number,
    height: number,
): VocalBrushState {
    return {
        active: null,
        heldSince: null,
        quietSince: null,
        x: width * 0.5,
        y: height * 0.5,
        targetX: width * 0.5,
        targetY: height * 0.5,
        nextTargetAt: 0,
        nextId: 100000,
    }
}

export function updateVocalBrush(
    state: VocalBrushState,
    audio: AudioFeatures,
    timestamp: number,
    width: number,
    height: number,
    colors: string[],
    intensity: number,
): VocalBrushResult {
    const result: VocalBrushResult = {
        changed: false,
        finished: null,
    }

    if (width <= 0 || height <= 0 || colors.length === 0) {
        return result
    }

    const activeSound = audio.mid > 0.105 && audio.energy > 0.055

    if (!activeSound) {
        state.heldSince = null

        if (state.active) {
            state.quietSince ??= timestamp

            if (timestamp - state.quietSince > 280) {
                result.finished = state.active
                state.active = null
                state.quietSince = null
                result.changed = true
            }
        }

        return result
    }

    state.quietSince = null
    state.heldSince ??= timestamp

    if (!state.active && timestamp - state.heldSince < 420) {
        return result
    }

    if (!state.active) {
        state.x = randomBetween(width * 0.15, width * 0.85)
        state.y = randomBetween(height * 0.15, height * 0.85)

        state.targetX = randomBetween(width * 0.1, width * 0.9)
        state.targetY = randomBetween(height * 0.1, height * 0.9)
        state.nextTargetAt = timestamp + 1100

        const id = state.nextId++

        state.active = {
            id,
            points: [
                {
                    x: state.x,
                    y: state.y,
                    pressure: 1,
                },
            ],
            color: colors[id % colors.length],
            size: Math.min(
                38,
                (5 + audio.bass * 26 + audio.mid * 18) * (intensity / 65),
            ),
            opacity: 0.86,
            mode: 'paint',
            preset: 'glow',
        }

        result.changed = true
    }

    const stroke = state.active
    if (!stroke) return result

    if (
        timestamp >= state.nextTargetAt ||
        Math.hypot(state.targetX - state.x, state.targetY - state.y) < 12
    ) {
        state.targetX = randomBetween(width * 0.08, width * 0.92)
        state.targetY = randomBetween(height * 0.08, height * 0.92)
        state.nextTargetAt = timestamp + randomBetween(900, 1900)
    }

    const speed = 0.012 + Math.min(0.06, audio.mid * 0.14)

    state.x += (state.targetX - state.x) * speed
    state.y += (state.targetY - state.y) * speed

    const wave = timestamp * 0.001

    const x = Math.max(
        0,
        Math.min(width, state.x + Math.sin(wave * 3.1) * 5),
    )

    const y = Math.max(
        0,
        Math.min(height, state.y + Math.cos(wave * 2.7) * 5),
    )

    const last = stroke.points[stroke.points.length - 1]

    if (
        Math.hypot(x - last.x, y - last.y) >= 1 &&
        stroke.points.length < 3000
    ) {
        stroke.points.push({ x, y, pressure: 1 })
        result.changed = true
    }

    if (stroke.points.length >= 3000) {
        result.finished = stroke
        state.active = null
        state.heldSince = timestamp - 420
        result.changed = true
    }

    return result
}