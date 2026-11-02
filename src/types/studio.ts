export type PaintingStyle = 'Bloom' | 'Flow' | 'Pulse';

export interface ColorPalette {
    name: string;
    colors: string[];
}

export interface PaintingSettings {
    style: PaintingStyle;
    palette: number;
    intensity: number;
    density: number;
}