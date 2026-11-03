
export type AutoBrush =
    | 'surprise'
    | 'block'
    | 'paint'
    | 'hair'
    | 'glow'

type StrokeBrush = Exclude<AutoBrush, 'surprise'>

export interface PaintPoint {
    x: number
    y: number
    pressure: number
}

export interface PaintMark {
    id: number
    brush: StrokeBrush
    points: PaintPoint[]
    size: number
    color: string
    opacity: number
    seed: number
}

export interface PaintDirector {
    // SONG_PAINTER_PITCH_V4: pitch state for note-driven turns.
    lastPitch?: number
    pitchTurn?: number
    marks: PaintMark[]
    active: PaintMark | null
    elapsed: number
    voiceTime: number
    quietTime: number
    x: number
    y: number
    heading: number
    nextId: number
}

export interface StrokeUpdate {
    segments: Array<{ mark: PaintMark; index: number }>
    started: boolean
    finished: boolean
}

const clamp = (x: number, min: number, max: number) =>
    Math.max(min, Math.min(max, x))

const seeded = (x: number) => {
    const n = Math.sin(x * 127.1 + 78.233) * 43758.5453
    return n - Math.floor(n)
}

export function createPaintDirector(): PaintDirector {
    return {
        marks: [],
        active: null,
        elapsed: 0,
        voiceTime: 0,
        quietTime: 0,
        x: 0.5,
        y: 0.5,
        heading: 0,
        nextId: 1,
    }
}

function pickBrush(selected: AutoBrush): StrokeBrush {
    if (selected !== 'surprise') return selected

    const choices: StrokeBrush[] = [
        'paint', 'paint', 'hair', 'hair', 'glow', 'block',
    ]

    return choices[Math.floor(Math.random() * choices.length)]
}

// SONG_PAINTER_COMPOSITION_PATCH_V1
// SONG_PAINTER_EXPRESSION_V5: soft curves and stronger vocal dynamics.
export function advanceVocalPainter(
  director: PaintDirector,
  dtMs: number,
  vocalLevel: number,
  brush: AutoBrush,
  colors: string[],
  intensity: number,
  sensitivity: number,
pitchMidi = 0,
): StrokeUpdate {
  const result: StrokeUpdate = {
    segments: [],
    started: false,
    finished: false,
  }

  if (!colors.length || director.marks.length >= 2000) {
    return result
  }

  const dt = clamp(dtMs, 0, 80)
  director.elapsed += dt

  const startThreshold =
    0.11 +
    (100 - clamp(sensitivity, 0, 100)) * 0.0034

  const releaseThreshold = Math.max(0.025, startThreshold * 0.68)

  const activeStroke = director.active !== null
  const activeThreshold = activeStroke
    ? releaseThreshold
    : startThreshold

  const activeVoice =
    Number.isFinite(vocalLevel) &&
    vocalLevel >= activeThreshold

  if (!activeVoice) {
    director.voiceTime = 0
    director.quietTime += dt

    if (director.active && director.quietTime >= 110) {
      director.active = null
      result.finished = true
    }

    return result
  }

  director.quietTime = 0
  director.voiceTime += dt

  if (!director.active && director.voiceTime < 70) {
    return result
  }

  if (!director.active) {
    const id = director.nextId++

    // Organized placement: phrases orbit around the center
    // with mild jitter, instead of spawning anywhere.
    const orbit = id * 2.399963229728653
    const ring = 0.05 + 0.13 * Math.sqrt((id % 17) / 17)
    const jitterX = (seeded(id * 8.17) - 0.5) * 0.04
    const jitterY = (seeded(id * 5.23) - 0.5) * 0.035

    director.x = clamp(
      0.5 + Math.cos(orbit) * ring + jitterX,
      0.18,
      0.82,
    )

    director.y = clamp(
      0.5 + Math.sin(orbit) * ring * 0.8 + jitterY,
      0.2,
      0.8,
    )

    // Head the stroke roughly across the canvas,
    // then let it curve gradually.
    const lateral = id % 2 === 0 ? 0 : Math.PI
    director.heading =
      lateral +
      (seeded(id * 3.11) - 0.5) * 0.55

    const selectedBrush = pickBrush(brush)

    const mark: PaintMark = {
      id,
      brush: selectedBrush,
      points: [
        {
          x: director.x,
          y: director.y,
          pressure: 0.12,
        },
      ],
      size:
        0.0018 + Math.pow(clamp(intensity, 0, 100) / 100, 1.4) * 0.029,
      color: colors[(id - 1) % colors.length],
      opacity: 0.72 + seeded(id * 9.3) * 0.14,
      seed: id * 17.37,
    }

    director.marks.push(mark)
    director.active = mark
    result.started = true
  }

  const mark = director.active
  if (!mark) return result

  const strength = clamp(
    (vocalLevel - releaseThreshold) /
      Math.max(0.01, 1 - releaseThreshold),
    0,
    1,
  )

  // Vocal strength affects both speed and pressure.
  const speed = 0.028 + strength * 0.065
  const distance = speed * dt / 1000

  const origin = mark.points[0]
  const last = mark.points[mark.points.length - 1]
  const pointCount = mark.points.length

  // Softly evolving curvature, more organic than random turns.
  const drift =
    Math.sin(director.elapsed * 0.0011 + mark.seed) * 0.35 +
    Math.sin(director.elapsed * 0.00047 + mark.seed * 0.7) * 0.18

  const phraseAge = Math.min(1, pointCount / 90)
  director.heading +=
    Math.sin(director.elapsed * 0.002 + mark.seed * 0.1) * dt * 0.00055 +
    drift * dt * 0.00023 * (0.45 + phraseAge)

  // Gently curl back toward the local phrase center so the
  // artwork develops into clustered brushwork rather than ribbons.
  const pullRadius = 0.1 + strength * 0.08
  const distanceFromOrigin = Math.hypot(
    director.x - origin.x,
    director.y - origin.y,
  )

  if (distanceFromOrigin > pullRadius) {
    const returnAngle = Math.atan2(
      origin.y - director.y,
      origin.x - director.x,
    )

    const difference = Math.atan2(
      Math.sin(returnAngle - director.heading),
      Math.cos(returnAngle - director.heading),
    )

    director.heading += clamp(difference, -1.2, 1.2) * Math.min(0.025, dt / 1600)
  }


  // SONG_PAINTER_PITCH_V4: change direction when the detected vocal note rises/falls.
  // Quiet notes or uncertain pitch never create brush movement alone.
  if (Number.isFinite(pitchMidi) && pitchMidi > 0) {
    const previousPitch = director.lastPitch || 0
    if (previousPitch > 0) {
      const interval = pitchMidi - previousPitch
      // Reject large octave jumps caused by harmonic ambiguity.
      if (Math.abs(interval) < 7) {
        director.pitchTurn =
          (director.pitchTurn ?? 0) * 0.8 +
          clamp(interval * 0.006, -0.018, 0.018)
      }
    }
    director.lastPitch = pitchMidi
  } else {
    director.lastPitch = 0
  }
  director.pitchTurn = (director.pitchTurn ?? 0) * Math.exp(-dt / 240)
  director.heading += clamp(director.pitchTurn, -0.022, 0.022) * Math.min(1, dt / 20)
  let nextX = director.x + Math.cos(director.heading) * distance
  let nextY = director.y + Math.sin(director.heading) * distance

  if (nextX < 0.08 || nextX > 0.92 || nextY < 0.08 || nextY > 0.92) {
    const centerAngle = Math.atan2(
      0.5 - director.y,
      0.5 - director.x,
    )
    director.heading += clamp(
      Math.atan2(Math.sin(centerAngle - director.heading), Math.cos(centerAngle - director.heading)),
      -0.055,
      0.055,
    )
    nextX = director.x + Math.cos(director.heading) * distance
    nextY = director.y + Math.sin(director.heading) * distance
  }

  director.x = clamp(nextX, 0.08, 0.92)
  director.y = clamp(nextY, 0.08, 0.92)

  // Taper in and out.
  const growth = Math.min(1, pointCount / 12)
  const taperOut = pointCount > 42
    ? Math.max(0.45, 1 - (pointCount - 42) / 160)
    : 1

  const targetPressure =
    (0.12 + Math.pow(strength, 1.3) *
      (0.18 + clamp(intensity, 0, 100) / 100 * 0.85)) * growth * taperOut

  const pressure =
    last.pressure +
    (targetPressure - last.pressure) * Math.min(1, dt / 75)

  const point: PaintPoint = {
    x: director.x,
    y: director.y,
    pressure: clamp(pressure, 0.06, 1),
  }

  if (
    Math.hypot(
      point.x - last.x,
      point.y - last.y,
    ) < 0.00004
  ) {
    return result
  }

  mark.points.push(point)

  result.segments.push({
    mark,
    index: mark.points.length - 1,
  })

  if (mark.points.length >= 2400) {
    const continuation: PaintMark = {
      ...mark,
      id: director.nextId++,
      points: [{ ...point, pressure: point.pressure * 0.92 }],
    }

    director.marks.push(continuation)
    director.active = continuation
  }

  return result
}

export function drawArtworkBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
) {
    ctx.save()

    const gradient = ctx.createRadialGradient(
        width * 0.45,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8,
    )

    gradient.addColorStop(0, '#24202c')
    gradient.addColorStop(0.55, '#17141e')
    gradient.addColorStop(1, '#0e0c13')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
}

export function drawPaintSegment(
  ctx: CanvasRenderingContext2D,
  mark: PaintMark,
  index: number,
  width: number,
  height: number,
) {
  if (index < 1 || index >= mark.points.length) return

  const from = mark.points[index - 1]
  const to = mark.points[index]

  const x1 = from.x * width
  const y1 = from.y * height
  const x2 = to.x * width
  const y2 = to.y * height

  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)

  if (length < 0.001) return

  const nx = -dy / length
  const ny = dx / length

  const unit = Math.min(width, height)
  const pressure = (from.pressure + to.pressure) / 2
  const size = mark.size * unit * pressure

  // Painterly texture helpers.
  const strand = (offset: number, thickness: number, alpha: number) => {
    ctx.globalAlpha = alpha
    ctx.lineWidth = Math.max(0.3, thickness)
    ctx.beginPath()
    ctx.moveTo(x1 + nx * offset, y1 + ny * offset)
    ctx.lineTo(x2 + nx * offset, y2 + ny * offset)
    ctx.stroke()
  }

  const colorNoise = (seedOffset: number) => {
    const a = 0.92 + seeded(mark.seed + seedOffset) * 0.14
    return a
  }

  ctx.save()
  ctx.strokeStyle = mark.color
  ctx.fillStyle = mark.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (mark.brush) {
    case 'block': {
      const left = size * 0.75
      const right = size * 0.68
      ctx.globalAlpha = mark.opacity * 0.72
      ctx.beginPath()
      ctx.moveTo(x1 + nx * left, y1 + ny * left)
      ctx.lineTo(x2 + nx * left, y2 + ny * left)
      ctx.lineTo(x2 - nx * right, y2 - ny * right)
      ctx.lineTo(x1 - nx * right, y1 - ny * right)
      ctx.closePath()
      ctx.fill()

      ctx.globalAlpha = mark.opacity * 0.18
      strand(0, size * 0.26, mark.opacity * 0.18)
      break
    }

    case 'paint': {
      // Pigment body.
      ctx.globalAlpha = mark.opacity * 0.26 * colorNoise(index)
      ctx.lineWidth = Math.max(0.6, size * 2.05)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Soft underpaint.
      ctx.globalAlpha = mark.opacity * 0.13
      ctx.lineWidth = Math.max(0.8, size * 2.8)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Bristle texture.
      for (let i = 0; i < 11; i++) {
        const offset =
          (seeded(mark.seed + index * 3.7 + i * 11.2) - 0.5) * size * 1.45
        const thickness = size * (0.03 + seeded(mark.seed + i * 5.2) * 0.07)
        const alpha =
          mark.opacity * (0.12 + seeded(mark.seed + index + i) * 0.28)
        strand(offset, thickness, alpha)
      }

      // Slightly darker center filament.
      strand(0, size * 0.12, mark.opacity * 0.55)
      break
    }

    case 'hair': {
      for (let i = 0; i < 8; i++) {
        const offset =
          (i - 3.5) * size * 0.19 +
          (seeded(mark.seed + i + index * 0.33) - 0.5) * size * 0.07
        const alpha = mark.opacity * (0.26 + i * 0.05)
        strand(offset, Math.max(0.45, size * 0.018), alpha)
      }
      break
    }

    case 'glow': {
      ctx.shadowColor = mark.color
      ctx.shadowBlur = size * 2.1
      strand(0, size * 1.75, mark.opacity * 0.34)
      ctx.shadowBlur = size * 0.7
      strand(0, size * 0.52, mark.opacity * 0.82)
      break
    }
  }

  ctx.restore()
}

export function renderAutoArtwork(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    marks: PaintMark[],
) {
    drawArtworkBackground(ctx, width, height)

    for (const mark of marks) {
        for (let i = 1; i < mark.points.length; i++) {
            drawPaintSegment(ctx, mark, i, width, height)
        }
    }
}
