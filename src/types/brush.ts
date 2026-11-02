
export interface BrushPoint {
    x: number
    y: number
    pressure: number
}

export interface BrushStroke {
    id: number
    points: BrushPoint[]
    color: string
    size: number
    opacity: number
}
