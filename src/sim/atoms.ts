import { atom } from 'jotai'
import type { TwoController } from './TwoController'
import type { GameState } from './socketClient'

export const mapClass = atom<TwoController | null>(null)
export const gridAtom = atom<GameState['grid'] | null>(null)
