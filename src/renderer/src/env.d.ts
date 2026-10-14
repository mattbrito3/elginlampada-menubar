type LampFavorite = {
  id: string
  name: string
  mode: string
  brightness: number
  temperature: number
  colour: { h: number; s: number; v: number }
}

interface Window {
  lampApi: {
    getConfigurationStatus: () => Promise<{ configured: boolean }>
    onToggle: (callback: () => void) => () => void
    getState: () => Promise<{
      online: boolean
      power: boolean
      mode: string
      brightness: number
      temperature: number
      colour: { h: number; s: number; v: number }
    }>
    setPower: (power: boolean) => Promise<ReturnType<Window['lampApi']['getState']> extends Promise<infer T> ? T : never>
    setBrightness: (brightness: number) => ReturnType<Window['lampApi']['getState']>
    setColour: (colour: { h: number; s: number; v: number }) => ReturnType<Window['lampApi']['getState']>
    setTemperature: (temperature: number) => ReturnType<Window['lampApi']['getState']>
    listFavorites: () => Promise<LampFavorite[]>
    saveFavorite: (favorite: LampFavorite) => Promise<LampFavorite[]>
    deleteFavorite: (id: string) => Promise<LampFavorite[]>
  }
}
