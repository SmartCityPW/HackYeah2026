import { PlayerPosition } from '../game.model';

/** Pozycja gracza w kształcie `PositionRequest` z kontraktu (bez pól, których nie ma: dokładności i czasu przy symulacji). */
export interface PositionDto {
  lat: number;
  lng: number;
  accuracyM?: number;
  takenAt?: string;
  source?: 'gps' | 'simulated';
}

export function toPositionDto(p: PlayerPosition): PositionDto {
  return {
    lat: p.lat,
    lng: p.lng,
    ...(p.accuracyM !== undefined ? { accuracyM: p.accuracyM } : {}),
    ...(p.takenAt !== undefined ? { takenAt: p.takenAt } : {}),
    ...(p.source !== undefined ? { source: p.source } : {}),
  };
}
