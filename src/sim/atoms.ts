// src/sim/atoms.ts
import { atom } from 'jotai'
import type { TwoController } from './TwoController'

export type GridState = { width: number; height: number; obstacles: Set<string> }

export const mapClass = atom<TwoController | null>(null)
export const gridAtom = atom<GridState | null>(null)
