import { contextBridge, ipcRenderer } from 'electron'
import type { LampState } from '../main/tuya-cloud'

export type Favorite = {
  id: string
  name: string
  mode: LampState['mode']
  brightness: number
  temperature: number
  colour: LampState['colour']
}

contextBridge.exposeInMainWorld('lampApi', {
  getConfigurationStatus: (): Promise<{ configured: boolean }> =>
    ipcRenderer.invoke('tuya:configuration-status'),
  getState: (): Promise<LampState> => ipcRenderer.invoke('lamp:get-state'),
  setPower: (power: boolean): Promise<LampState> => ipcRenderer.invoke('lamp:set-power', power),
  setBrightness: (brightness: number): Promise<LampState> =>
    ipcRenderer.invoke('lamp:set-brightness', brightness),
  setColour: (colour: { h: number; s: number; v: number }): Promise<LampState> =>
    ipcRenderer.invoke('lamp:set-colour', colour),
  setTemperature: (temperature: number): Promise<LampState> =>
    ipcRenderer.invoke('lamp:set-temperature', temperature),
  listFavorites: (): Promise<Favorite[]> => ipcRenderer.invoke('favorites:list'),
  saveFavorite: (favorite: Favorite): Promise<Favorite[]> =>
    ipcRenderer.invoke('favorites:save', favorite),
  deleteFavorite: (id: string): Promise<Favorite[]> =>
    ipcRenderer.invoke('favorites:delete', id),
  onToggle: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('lamp:toggle', listener)
    return () => ipcRenderer.removeListener('lamp:toggle', listener)
  }
})
