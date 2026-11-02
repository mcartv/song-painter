
export interface BrushPoint {
    x: number
    y: number
    pressure: number
}

export type BrushMode = 'paint' | 'erase'

export interface BrushStroke {
    id: number
    points: BrushPoint[]
    color: string
    size: number
    opacity: number
    mode?: BrushMode
}
