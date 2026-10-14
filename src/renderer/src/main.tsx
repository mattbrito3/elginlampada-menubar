import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type LampState = Awaited<ReturnType<typeof window.lampApi.getState>>
type Colour = LampState['colour']

const whitePresets = [
  { name: 'Amarelo queimado', temperature: 0, colour: '#ffc46b' },
  { name: 'Branco quente', temperature: 250, colour: '#ffe0a8' },
  { name: 'Branco natural', temperature: 500, colour: '#fff5dc' },
  { name: 'Branco frio', temperature: 750, colour: '#e4f1ff' },
  { name: 'Super branco', temperature: 1000, colour: '#d8eaff' }
] as const

function App(): React.JSX.Element {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [state, setState] = useState<LampState | null>(null)
  const stateRef = useRef<LampState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftColour, setDraftColour] = useState<Colour>({ h: 0, s: 1000, v: 1000 })
  const [draftBrightness, setDraftBrightness] = useState(1000)
  const [draftTemperature, setDraftTemperature] = useState(590)
  const [favorites, setFavorites] = useState<LampFavorite[]>([])
  const [showFavorites, setShowFavorites] = useState(false)
  const [favoriteName, setFavoriteName] = useState('')
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [updating, setUpdating] = useState(false)
  const colourDirty = useRef(false)
  const brightnessDirty = useRef(false)
  const temperatureDirty = useRef(false)
  const colourRequest = useRef(0)
  const brightnessRequest = useRef(0)
  const temperatureRequest = useRef(0)

  const refresh = async (): Promise<void> => {
    try {
      setError(null)
      const nextState = await window.lampApi.getState()
      stateRef.current = nextState
      setState(nextState)
      if (!colourDirty.current) setDraftColour(nextState.colour)
      if (!brightnessDirty.current) setDraftBrightness(nextState.brightness)
      if (!temperatureDirty.current) setDraftTemperature(nextState.temperature)
    } catch {
      setError('Não foi possível consultar a lâmpada.')
    }
  }

  const toggle = async (): Promise<void> => {
    const currentState = stateRef.current
    if (!currentState) return
    try {
      setError(null)
      const nextState = await window.lampApi.setPower(!currentState.power)
      stateRef.current = nextState
      setState(nextState)
    } catch {
      setError('Não foi possível alterar a energia.')
    }
  }

  useEffect(() => {
    void window.lampApi.getConfigurationStatus().then((status) => {
      setConfigured(status.configured)
    })
    void window.lampApi.listFavorites().then(setFavorites).catch(() => {
      setError('Não foi possível carregar os favoritos.')
    })
    void refresh()
    return window.lampApi.onToggle(() => { void toggle() })
  }, [])

  const saveCurrentFavorite = async (): Promise<void> => {
    const currentState = stateRef.current
    const name = favoriteName.trim()
    if (!currentState) {
      setError('Aguarde o estado da lâmpada ser carregado.')
      return
    }
    if (!name) {
      setError('Informe um nome para o favorito.')
      return
    }
    try {
      setSavingFavorite(true)
      setError(null)
      const saved = await window.lampApi.saveFavorite({
        id: crypto.randomUUID(),
        name,
        mode: currentState.mode,
        brightness: draftBrightness,
        temperature: draftTemperature,
        colour: draftColour
      })
      setFavorites(saved)
      setFavoriteName('')
    } catch {
      setError('Não foi possível salvar o favorito.')
    } finally {
      setSavingFavorite(false)
    }
  }

  const applyFavorite = async (favorite: LampFavorite): Promise<void> => {
    try {
      setError(null)
      let nextState = await window.lampApi.setBrightness(favorite.brightness)
      if (favorite.mode === 'white') {
        nextState = await window.lampApi.setTemperature(favorite.temperature)
      } else if (favorite.mode === 'colour') {
        nextState = await window.lampApi.setColour(favorite.colour)
      }
      stateRef.current = nextState
      setState(nextState)
      setDraftBrightness(favorite.brightness)
      setDraftTemperature(favorite.temperature)
      setDraftColour(favorite.colour)
    } catch {
      setError('Não foi possível aplicar o favorito.')
    }
  }

  const deleteFavorite = async (id: string): Promise<void> => {
    try {
      setFavorites(await window.lampApi.deleteFavorite(id))
    } catch {
      setError('Não foi possível excluir o favorito.')
    }
  }

  const applyWhitePreset = async (temperature: number): Promise<void> => {
    try {
      setError(null)
      setUpdating(true)
      const nextState = await window.lampApi.setTemperature(temperature)
      stateRef.current = nextState
      setState(nextState)
      setDraftTemperature(nextState.temperature)
      temperatureDirty.current = false
    } catch {
      setError('Não foi possível aplicar o preset de branco.')
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    if (!colourDirty.current) return
    const request = ++colourRequest.current
    const timer = window.setTimeout(() => {
      colourDirty.current = false
      setUpdating(true)
      void window.lampApi.setColour(draftColour).then((nextState) => {
        if (request === colourRequest.current) setState(nextState)
      }).catch(() => {
        if (request === colourRequest.current) setError('Não foi possível alterar a cor.')
      }).finally(() => {
        if (request === colourRequest.current) setUpdating(false)
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [draftColour])

  useEffect(() => {
    if (!brightnessDirty.current) return
    const request = ++brightnessRequest.current
    const timer = window.setTimeout(() => {
      brightnessDirty.current = false
      setUpdating(true)
      void window.lampApi.setBrightness(draftBrightness).then((nextState) => {
        if (request === brightnessRequest.current) setState(nextState)
      }).catch(() => {
        if (request === brightnessRequest.current) setError('Não foi possível alterar o brilho.')
      }).finally(() => {
        if (request === brightnessRequest.current) setUpdating(false)
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [draftBrightness])

  useEffect(() => {
    if (!temperatureDirty.current) return
    const request = ++temperatureRequest.current
    const timer = window.setTimeout(() => {
      temperatureDirty.current = false
      setUpdating(true)
      void window.lampApi.setTemperature(draftTemperature).then((nextState) => {
        if (request === temperatureRequest.current) setState(nextState)
      }).catch(() => {
        if (request === temperatureRequest.current) setError('Não foi possível alterar a temperatura.')
      }).finally(() => {
        if (request === temperatureRequest.current) setUpdating(false)
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [draftTemperature])

  const updateHueFromPointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const angle = Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2))
    const hue = Math.round((angle * 180 / Math.PI + 90 + 360) % 360)
    colourDirty.current = true
    setDraftColour((current) => ({ ...current, h: hue }))
  }

  const updateSquareFromPointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const saturation = Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 1000)
    const value = Math.round(Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height)) * 1000)
    colourDirty.current = true
    setDraftColour((current) => ({ ...current, s: saturation, v: value }))
  }

  const isOn = state?.power ?? false
  const colour = draftColour
  const previewLightness = Math.max(8, Math.min(72, colour.v / 10))
  const previewSaturation = Math.max(5, colour.s / 10)
  const squareX = `${colour.s / 10}%`
  const squareY = `${100 - colour.v / 10}%`
  return (
    <main className="panel">
      <header className="top-tabs">
        <span className="active-tab">Luz</span>
      </header>
      <section className="device-card">
        <div className="device-heading">
          <div>
            <h1>Lâmpada Elgin</h1>
            <p>{isOn ? 'Ligada' : 'Desligada'}</p>
          </div>
          <button className="power-button" aria-label="Ligar ou desligar" disabled={updating} onClick={() => { void toggle() }}>
            ⏻
          </button>
        </div>
        <div className={`light-preview ${isOn ? 'on' : ''}`} style={{ background: isOn ? `radial-gradient(circle, hsl(${colour.h} ${previewSaturation}% ${previewLightness}%), #172736 78%)` : undefined }}>
          <span>{isOn ? 'Ligada' : 'Desligada'}</span>
        </div>
      </section>
      <nav className="inner-tabs" aria-label="Controles da lâmpada">
        <button className={!showFavorites ? 'selected' : ''} onClick={() => setShowFavorites(false)}>Cores</button>
        <button className={showFavorites ? 'selected' : ''} onClick={() => setShowFavorites(true)}>Favoritas</button>
      </nav>
      {showFavorites ? (
        <section className="favorites" aria-label="Favoritos">
          <form className="favorite-form" onSubmit={(event) => {
            event.preventDefault()
            void saveCurrentFavorite()
          }}>
            <input
              aria-label="Nome do favorito"
              placeholder={`Ex.: Favorito ${favorites.length + 1}`}
              maxLength={40}
              value={favoriteName}
              onChange={(event) => setFavoriteName(event.target.value)}
            />
            <button className="save-favorite" disabled={savingFavorite || !favoriteName.trim()} type="submit">
              {savingFavorite ? 'Salvando...' : 'Salvar estado atual'}
            </button>
          </form>
          {favorites.length === 0 && <p>Nenhum favorito salvo.</p>}
          {favorites.map((favorite) => (
            <article className="favorite-row" key={favorite.id}>
              <button onClick={() => { void applyFavorite(favorite) }}>
                <strong>{favorite.name}</strong>
                <span>{favorite.mode} · brilho {favorite.brightness}</span>
              </button>
              <button className="delete-favorite" aria-label={`Excluir ${favorite.name}`} onClick={() => { void deleteFavorite(favorite.id) }}>×</button>
            </article>
          ))}
        </section>
      ) : (
      <section className="color-placeholder" aria-label="Seletor de cor">
        <div className="white-presets" aria-label="Brancos predefinidos">
          <div className="section-heading">
            <span>Brancos do dia a dia</span>
            <small>Temperatura</small>
          </div>
          <div className="preset-grid">
            {whitePresets.map((preset) => (
              <button
                className={`white-preset ${state?.mode === 'white' && draftTemperature === preset.temperature ? 'active' : ''}`}
                key={preset.name}
                disabled={updating}
                onClick={() => { void applyWhitePreset(preset.temperature) }}
              >
                <span className="preset-swatch" style={{ background: preset.colour }} />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          className="hue-ring"
          onPointerDown={(event) => {
            updateHueFromPointer(event)
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 0) updateHueFromPointer(event)
          }}
        >
          <span className="hue-marker" style={{ transform: `translateX(-50%) rotate(${colour.h}deg) translateY(0)` }} aria-hidden="true" />
          <div
            className="color-square"
            style={{ background: `linear-gradient(to top, #000, #0000), linear-gradient(to right, #fff, hsl(${colour.h} 100% 50%))` }}
            onPointerDown={(event) => {
              event.stopPropagation()
              updateSquareFromPointer(event)
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              event.stopPropagation()
              if (event.buttons !== 0) updateSquareFromPointer(event)
            }}
          >
            <span className="square-marker" style={{ left: squareX, top: squareY }} aria-hidden="true" />
          </div>
        </div>
        <label>
          <span>Matiz <output>{colour.h}°</output></span>
          <input type="range" min="0" max="360" value={colour.h} onChange={(event) => {
            colourDirty.current = true
            setDraftColour({ ...colour, h: Number(event.target.value) })
          }} />
        </label>
        <label>
          <span>Saturação <output>{colour.s}</output></span>
          <input type="range" min="0" max="1000" value={colour.s} onChange={(event) => {
            colourDirty.current = true
            setDraftColour({ ...colour, s: Number(event.target.value) })
          }} />
        </label>
        <label>
          <span>Brilho <output>{draftBrightness}</output></span>
          <input type="range" min="10" max="1000" value={draftBrightness} onChange={(event) => {
            brightnessDirty.current = true
            setDraftBrightness(Number(event.target.value))
          }} />
        </label>
        {state?.mode === 'white' && (
          <label>
            <span>Temperatura <output>{draftTemperature}</output></span>
            <input type="range" min="0" max="1000" value={draftTemperature} onChange={(event) => {
              temperatureDirty.current = true
              setDraftTemperature(Number(event.target.value))
            }} />
          </label>
        )}
        <p className={error ? 'message error' : 'message'}>{error ?? (updating ? 'Aplicando alteração...' : state ? `Modo ${state.mode}; brilho ${state.brightness}/1000` : 'Carregando estado...')}</p>
      </section>
      )}
      <footer>
        <span className={configured ? 'status ok' : 'status'}>
          {configured === null ? 'Verificando configuração...' : configured ? 'Tuya configurada' : 'Configure o arquivo .env'}
        </span>
        <button className="refresh" aria-label="Atualizar estado" onClick={() => { void refresh() }}>↻</button>
      </footer>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
