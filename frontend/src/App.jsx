import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const hashCode = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

const getPlaceholderImage = (name) => {
  const colors = ['FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', '98D8C8', 'F7DC6F', 'BB8FCE', '85C1E2']
  const colorIndex = hashCode(name) % colors.length
  const color = colors[colorIndex]
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='%23${color}' width='300' height='300'/%3E%3Ctext x='50%25' y='50%25' font-size='60' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle'%3E${initials}%3C/text%3E%3C/svg%3E`
}

const emptyAssets = []

const mapApiAsset = (asset, index = 0) => ({
  ...asset,
  type: asset.metadata?.type || asset.content_type?.split('/').pop()?.toUpperCase() || 'FILE',
  kind: asset.content_type?.startsWith('video/') ? 'video' : asset.content_type?.startsWith('image/') ? 'image' : 'file',
  size: `${(Number(asset.size_bytes || 0) / 1024 / 1024).toFixed(1)} MB`,
  color: ['coral', 'blue', 'green', 'yellow'][index % 4],
  updated: asset.updated_at ? new Date(asset.updated_at).toLocaleDateString() : 'Recently',
  image: asset.metadata?.doodle_image_data_url || getPlaceholderImage(asset.name),
})

const initialAuthForm = {
  username: '',
  email: '',
  password: '',
}

const initialCustomAssetForm = {
  name: '',
  type: 'JPG',
  size: '1.2 MB',
}

function AuthView({ authMode, setAuthMode, authForm, setAuthForm, isSubmitting, authMessage, onLogin, onSignup, theme, toggleTheme }) {
  const isLogin = authMode === 'login'

  const handleChange = (event) => {
    const { name, value } = event.target
    setAuthForm((current) => ({ ...current, [name]: value }))
  }

  return (
    <div className={`auth-shell theme-${theme}`}>
      <button type="button" className="theme-toggle auth-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="auth-panel auth-branding">
        <div className="brand-chip">Digital Asset</div>
        <h1>Organize your creative work in one secure place.</h1>
        <p>Manage assets, collaborate faster, and keep every file easy to find.</p>
        <ul>
          <li>Approval-ready asset library</li>
          <li>Fast discovery and sharing</li>
          <li>Built for creative teams</li>
        </ul>
      </div>

      <div className="auth-panel auth-form-panel">
        <div className="auth-toggle">
          <button type="button" className={isLogin ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
          <button type="button" className={!isLogin ? 'active' : ''} onClick={() => setAuthMode('signup')}>Sign up</button>
        </div>

        <div className="auth-header">
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p>{isLogin ? 'Sign in to continue to your workspace.' : 'Create a new account to continue.'}</p>
        </div>

        {authMessage && <div className="auth-message">{authMessage}</div>}

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (isLogin) onLogin(event)
            else onSignup(event)
          }}
        >
          <label>
            <span>Username</span>
            <input name="username" value={authForm.username} onChange={handleChange} placeholder="Username" required />
          </label>

          {!isLogin && (
            <label>
              <span>Email</span>
              <input type="email" name="email" value={authForm.email} onChange={handleChange} placeholder="you@example.com" required />
            </label>
          )}

          <label>
            <span>Password</span>
            <input type="password" name="password" value={authForm.password} onChange={handleChange} placeholder="Password" required />
          </label>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Login' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  )
}

function DoodleCanvas({ onDrawingChange, selectedIdea, onIdeaSelect, drawingIdeas = [] }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const hasDrawing = useRef(false)
  const [brushColor, setBrushColor] = useState('#243c37')
  const [brushSize, setBrushSize] = useState(5)

  const getPoint = (event) => {
    const canvas = canvasRef.current
    const bounds = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    }
  }

  const startDrawing = (event) => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const { x, y } = getPoint(event)
    canvas.setPointerCapture(event.pointerId)
    context.fillStyle = brushColor
    context.beginPath()
    const scale = canvas.width / canvas.getBoundingClientRect().width
    context.arc(x, y, (brushSize * scale) / 2, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.moveTo(x, y)
    context.strokeStyle = brushColor
    context.lineWidth = brushSize * scale
    context.lineCap = 'round'
    context.lineJoin = 'round'
    hasDrawing.current = true
    isDrawing.current = true
  }

  const draw = (event) => {
    if (!isDrawing.current) return
    const context = canvasRef.current.getContext('2d')
    const { x, y } = getPoint(event)
    context.lineTo(x, y)
    context.stroke()
    hasDrawing.current = true
  }

  const finishDrawing = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (hasDrawing.current) onDrawingChange(canvasRef.current.toDataURL('image/png'))
  }

  const clearDrawing = () => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    hasDrawing.current = false
    onDrawingChange('')
  }

  const chooseIdea = (idea) => {
    onIdeaSelect(idea.title)
    const image = new Image()
    image.onload = () => {
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      context.fillStyle = '#fffdf8'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      hasDrawing.current = true
      onDrawingChange(canvas.toDataURL('image/png'))
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(idea.svg)}`
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const scale = window.devicePixelRatio || 1
      const width = Math.round(bounds.width * scale)
      const height = Math.round(bounds.height * scale)
      if (canvas.width === width && canvas.height === height) return
      const previous = document.createElement('canvas')
      previous.width = canvas.width
      previous.height = canvas.height
      previous.getContext('2d').drawImage(canvas, 0, 0)
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.fillStyle = '#fffdf8'
      context.fillRect(0, 0, width, height)
      if (hasDrawing.current) context.drawImage(previous, 0, 0, width, height)
    }
    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(canvas)
    resizeCanvas()
    return () => observer.disconnect()
  }, [])

  return (
    <section className="doodle-editor" aria-label="Doodle drawing area">
      <div className="doodle-heading">
        <div><strong>Draw your asset</strong><span>Sketch directly on the canvas. Your drawing is saved with the asset.</span></div>
        <button type="button" className="ghost doodle-clear" onClick={clearDrawing}>Clear</button>
      </div>
      <div className="doodle-toolbar">
        <label className="doodle-color-label" title="Brush color">
          <span>Color</span>
          <input aria-label="Brush color" type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />
        </label>
        <label className="doodle-size-label">
          <span>Brush</span>
          <input aria-label="Brush size" type="range" min="2" max="18" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
        </label>
        <span className="doodle-hint">Draw with your mouse, finger, or pen</span>
      </div>
      {drawingIdeas.length > 0 && (
        <div className="drawing-ideas">
          <div className="drawing-ideas-heading"><strong>Suggested doodles</strong><span>Choose a sketch to place it on the canvas</span></div>
          <div className="drawing-idea-list">
            {drawingIdeas.map((idea, index) => (
              <button type="button" key={`${idea.title}-${index}`} className={`drawing-idea ${selectedIdea === idea.title ? 'selected' : ''}`} onClick={() => chooseIdea(idea)} aria-label={`Use suggested doodle ${index + 1}`} title={idea.title}>
                <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(idea.svg)}`} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="doodle-canvas"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        onPointerLeave={finishDrawing}
        aria-label="Blank white drawing canvas"
      />
    </section>
  )
}

function DashboardApp({ onLogout, theme, toggleTheme, apiRequest }) {
  const [assets, setAssets] = useState(emptyAssets)
  const [trashAssets, setTrashAssets] = useState(emptyAssets)
  const [activeSection, setActiveSection] = useState('assets')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState([])
  const [starred, setStarred] = useState([])
  const [notice, setNotice] = useState('')
  const [menu, setMenu] = useState(null)
  const [previewAsset, setPreviewAsset] = useState(null)
  const [customAssetOpen, setCustomAssetOpen] = useState(false)
  const [customAssetForm, setCustomAssetForm] = useState(initialCustomAssetForm)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [drawingDataUrl, setDrawingDataUrl] = useState('')
  const [selectedDrawingIdea, setSelectedDrawingIdea] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const fileInput = useRef(null)

  const requestAiSuggestions = useCallback(async (assetName, assetType) => {
    const trimmedName = (assetName || '').trim()
    if (!trimmedName) {
      setAiSuggestions(null)
      setAiError('')
      return
    }

    setIsAiLoading(true)
    setAiError('')

    try {
      const response = await apiRequest('/api/ai/metadata/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_name: trimmedName,
          asset_type: assetType,
          file_extension: assetType.toLowerCase(),
          mime_type: assetType.toLowerCase() === 'mp4' ? 'video/mp4' : 'image/png',
          content_context: `digital asset for ${trimmedName}`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to generate AI suggestions.')
      }

      setAiSuggestions(data?.suggestions || null)
    } catch (error) {
      setAiSuggestions(null)
      setAiError(error.message || 'Unable to generate AI suggestions.')
    } finally {
      setIsAiLoading(false)
    }
  }, [apiRequest])

  useEffect(() => {
    const trimmedName = customAssetForm.name.trim()
    if (!trimmedName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiSuggestions(null)
      setAiError('')
      return
    }

    const timer = window.setTimeout(() => {
      requestAiSuggestions(customAssetForm.name, customAssetForm.type)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [customAssetForm.name, customAssetForm.type, requestAiSuggestions])

  useEffect(() => {
    const token = window.localStorage.getItem('dam_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    apiRequest('/api/assets/', { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setAssets(Array.isArray(data) ? data.map(mapApiAsset) : []))
      .catch(() => setAssets([]))

    apiRequest('/api/assets/trash/', { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setTrashAssets(Array.isArray(data) ? data.map(mapApiAsset) : []))
      .catch(() => setTrashAssets([]))
  }, [apiRequest])

  const openTrash = async () => {
    setActiveSection('trash')
    try {
      const response = await apiRequest('/api/assets/trash/')
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'Unable to load the trash.')
      setTrashAssets(Array.isArray(data) ? data.map(mapApiAsset) : [])
    } catch (error) {
      showNotice(error.message || 'Unable to load the trash.')
    }
  }

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPreviewAsset(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const currentAssets = activeSection === 'trash' ? trashAssets : assets
  const visibleAssets = useMemo(() => {
    const filtered = currentAssets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || asset.type === filter))
    return [...filtered].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : 0))
  }, [currentAssets, filter, query, sort])

  const totalAssetCount = assets.length
  const favoriteAssets = assets.filter((asset) => starred.includes(asset.name))

  const toggleStar = (name) => setStarred((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const showNotice = (message) => {
    setNotice(message)
    setMenu(null)
  }

  const downloadAsset = async (asset) => {
    const sourceUrl = asset?.download_url || asset?.image || asset?.url
    if (!sourceUrl) {
      showNotice(`No downloadable file found for ${asset?.name || 'this asset'}.`)
      return
    }

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          ...(window.localStorage.getItem('dam_token') ? { Authorization: `Bearer ${window.localStorage.getItem('dam_token')}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error('Unable to download this asset.')
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = asset.name || 'download'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
      showNotice(`${asset.name} download started.`)
    } catch {
      const fallbackLink = document.createElement('a')
      fallbackLink.href = sourceUrl
      fallbackLink.download = asset.name || 'download'
      fallbackLink.target = '_blank'
      fallbackLink.rel = 'noopener noreferrer'
      document.body.appendChild(fallbackLink)
      fallbackLink.click()
      fallbackLink.remove()
      showNotice(`${asset.name} download started.`)
    }
  }

  const deleteAsset = async (asset) => {
    try {
      const isPersisted = /^[0-9a-f-]{36}$/i.test(asset.id || '')
      if (isPersisted) {
        const response = await apiRequest(`/api/assets/${asset.id}/`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Unable to move this asset to trash.')
      }
      setAssets((current) => current.filter((item) => item.id !== asset.id))
      setTrashAssets((current) => [{ ...asset, deleted_at: new Date().toISOString() }, ...current.filter((item) => item.id !== asset.id)])
      setSelected((current) => current.filter((item) => item !== asset.name))
      setStarred((current) => current.filter((item) => item !== asset.name))
      showNotice(`${asset.name} moved to trash.`)
    } catch (error) {
      showNotice(error.message || 'Unable to move this asset to trash.')
    }
  }

  const restoreAsset = async (asset) => {
    try {
      const isPersisted = /^[0-9a-f-]{36}$/i.test(asset.id || '')
      if (isPersisted) {
        const response = await apiRequest(`/api/assets/${asset.id}/restore/`, { method: 'POST' })
        if (!response.ok) throw new Error('Unable to restore this asset.')
      }
      const restored = { ...asset, deleted_at: null }
      setTrashAssets((current) => current.filter((item) => item.id !== asset.id))
      setAssets((current) => [restored, ...current.filter((item) => item.id !== asset.id)])
      showNotice(`${asset.name} restored.`)
    } catch (error) {
      showNotice(error.message || 'Unable to restore this asset.')
    }
  }

  const permanentlyDeleteAsset = async (asset) => {
    if (!window.confirm(`Permanently delete ${asset.name}? This cannot be undone.`)) return
    try {
      const isPersisted = /^[0-9a-f-]{36}$/i.test(asset.id || '')
      if (isPersisted) {
        const response = await apiRequest(`/api/assets/${asset.id}/permanent-delete/`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Unable to permanently delete this asset.')
      }
      setTrashAssets((current) => current.filter((item) => item.id !== asset.id))
      showNotice(`${asset.name} permanently deleted.`)
    } catch (error) {
      showNotice(error.message || 'Unable to permanently delete this asset.')
    }
  }

  const renameAsset = (asset) => {
    const newName = window.prompt('Rename asset', asset.name)?.trim()
    if (!newName || newName === asset.name) {
      setMenu(null)
      return
    }
    setAssets((current) => current.map((item) => item.name === asset.name ? { ...item, name: newName } : item))
    setSelected((current) => current.map((item) => item === asset.name ? newName : item))
    setStarred((current) => current.map((item) => item === asset.name ? newName : item))
    if (previewAsset?.name === asset.name) setPreviewAsset({ ...previewAsset, name: newName })
    showNotice(`${asset.name} renamed to ${newName}.`)
  }

  const handleFiles = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const added = files.map((file, index) => {
      const fileType = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
      const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(fileType)
      const isVideo = ['MP4', 'MOV', 'WEBM', 'AVI', 'MKV'].includes(fileType)
      let image = getPlaceholderImage(file.name)
      if (isImage || isVideo) image = URL.createObjectURL(file)

      return {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        type: fileType,
        kind: isImage ? 'image' : isVideo ? 'video' : 'file',
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        color: ['coral', 'blue', 'green', 'yellow'][index % 4],
        updated: 'Just now',
        image,
      }
    })

    setAssets((current) => [...added, ...current])
    showNotice(`${files.length} asset${files.length > 1 ? 's' : ''} added to this demo library.`)
    event.target.value = ''
  }

  const handleCreateCustomAsset = async () => {
    const trimmedName = customAssetForm.name.trim()
    if (!trimmedName) {
      showNotice('Asset name is required.')
      return
    }

    const token = window.localStorage.getItem('dam_token')
    const type = drawingDataUrl ? 'PNG' : customAssetForm.type.toUpperCase()
    const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(type)
    const isVideo = ['MP4', 'MOV', 'WEBM', 'AVI', 'MKV'].includes(type)
    const creationId = crypto.randomUUID()

    try {
      const payload = {
        name: trimmedName,
        object_key: `${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${creationId}.${type.toLowerCase()}`,
        content_type: isImage ? 'image/png' : isVideo ? 'video/mp4' : 'application/octet-stream',
        size_bytes: drawingDataUrl ? Math.round((drawingDataUrl.length * 3) / 4) : Number.parseInt(customAssetForm.size, 10) || 120000,
        metadata: {
          source: drawingDataUrl ? 'doodle_canvas' : 'custom_asset',
          type,
          generated_from: 'custom asset modal',
          ...(drawingDataUrl ? { doodle_image_data_url: drawingDataUrl } : {}),
        },
      }

      const response = await apiRequest('/api/assets/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || data?.non_field_errors?.[0] || 'Unable to create asset.')
      }

      const newAsset = {
        id: data.id || `custom-${creationId}`,
        name: data.name || trimmedName,
        type: data.metadata?.type || type,
        kind: isImage ? 'image' : isVideo ? 'video' : 'file',
        size: customAssetForm.size || `${Math.max(1, Math.round((data.size_bytes || 120000) / 1024 / 1024))} MB`,
        color: ['coral', 'blue', 'green', 'yellow'][hashCode(trimmedName) % 4],
        updated: 'Just now',
        image: drawingDataUrl || getPlaceholderImage(trimmedName),
      }

      setAssets((current) => [newAsset, ...current])
      setCustomAssetOpen(false)
      setCustomAssetForm(initialCustomAssetForm)
      setDrawingDataUrl('')
      setSelectedDrawingIdea('')
      showNotice(`${trimmedName} created successfully.`)
    } catch (error) {
      showNotice(error.message || 'Unable to create asset.')
    }
  }

  return (
    <div className={`shell theme-${theme}`} onClick={() => menu && setMenu(null)}>
      <aside className="sidebar">
        <div className="wordmark">Digital Asset</div>
        <nav>
          <p className="nav-label">Workspace</p>
          <button className={activeSection === 'assets' ? 'active' : ''} type="button" onClick={() => setActiveSection('assets')}><span>▦</span> All assets <b>{totalAssetCount}</b></button>
          <button type="button" onClick={() => showNotice('Collections view is coming next.')}><span>□</span> Collections</button>
          <button type="button" onClick={() => showNotice('No shared assets yet.')}><span>↗</span> Shared with me</button>
          <button className={activeSection === 'trash' ? 'active' : ''} type="button" onClick={openTrash}><span>⌫</span> Trash <b>{trashAssets.length}</b></button>
          <p className="nav-label second">Manage</p>
          <button type="button" onClick={() => showNotice('Activity view is coming next.')}><span>◷</span> Activity</button>
          <button type="button" onClick={() => showNotice('Settings view is coming next.')}><span>⚙</span> Settings</button>
          <div className="favorites-panel">
            <div className="favorites-heading"><span>Favorites</span><b>{favoriteAssets.length}</b></div>
            {favoriteAssets.length ? favoriteAssets.map((asset) => (
              <div className="favorite-item" key={asset.name} onClick={() => setPreviewAsset(asset)}>
                <img src={asset.image} alt="" />
                <span>{asset.name}</span>
                <button className="favorite-remove" type="button" onClick={(event) => { event.stopPropagation(); toggleStar(asset.name) }} aria-label={`Remove ${asset.name} from favorites`}>★</button>
              </div>
            )) : <p className="favorites-empty">No favorites yet.</p>}
          </div>
        </nav>
        <button className="profile" type="button" onClick={onLogout}><div><strong>Logout</strong></div></button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Library</span><b>/</b><strong>{activeSection === 'trash' ? 'Trash' : 'All assets'}</strong></div>
          <div className="top-actions">
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="icon-button" type="button" onClick={() => showNotice('You are all caught up.')} aria-label="Notifications">o</button>
            <input ref={fileInput} type="file" multiple hidden onChange={handleFiles} />
            <button className="upload secondary" type="button" onClick={() => { setDrawingDataUrl(''); setSelectedDrawingIdea(''); setCustomAssetOpen(true) }}>+ Create asset</button>
            <button className="upload" type="button" onClick={() => fileInput.current?.click()}>+ Upload assets</button>
          </div>
        </header>

        <section className="content" id="assets">
          <div className="title-row">
            <div>
              <p className="eyebrow">LIBRARY</p>
              <h1>{activeSection === 'trash' ? 'Trash' : 'All assets'} <span>{activeSection === 'trash' ? trashAssets.length : totalAssetCount}</span></h1>
              <p className="intro">{activeSection === 'trash' ? 'Deleted assets stay here until you restore or permanently delete them.' : 'Your asset library is empty until you upload files.'}</p>
            </div>
            <button className="ghost" type="button" onClick={() => setSelected(selected.length ? [] : visibleAssets.map((asset) => asset.name))}>{selected.length ? `Clear (${selected.length})` : 'Select all'}</button>
          </div>

          <div className="toolbar">
            <label className="search"><span>/</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" /></label>
            <select className="filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Filter: all types</option>
              <option value="JPG">Images</option>
              <option value="MP4">Video</option>
              <option value="PDF">Documents</option>
            </select>
            <select className="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Recently added</option>
              <option value="name">Name A-Z</option>
            </select>
            <button className={`view-toggle ${view === 'grid' ? '' : 'muted'}`} type="button" onClick={() => setView('grid')} aria-label="Grid view">▦</button>
            <button className={`view-toggle ${view === 'list' ? '' : 'muted'}`} type="button" onClick={() => setView('list')} aria-label="List view">☷</button>
          </div>

          <div className="summary">
            <span><b>{visibleAssets.length}</b> assets shown</span>
            <span className="dot-separator" />
            <span>{selected.length ? `${selected.length} selected` : `${totalAssetCount} total`}</span>
            <span className="summary-spacer" />
            <span className="sync">● {totalAssetCount > 0 ? 'Library active' : 'No files yet'}</span>
          </div>

          {visibleAssets.length ? (
            <div className={`asset-grid ${view === 'list' ? 'list-view' : ''}`}>
              {visibleAssets.map((asset, index) => (
                <article
                  className={`asset-card ${selected.includes(asset.name) ? 'selected' : ''}`}
                  key={asset.id ?? `${asset.name}-${asset.updated}-${index}`}
                  onClick={(event) => {
                    if (event.target.closest('button')) return
                    setPreviewAsset(asset)
                  }}
                >
                  <div className={`asset-preview ${asset.color}`} onClick={(event) => { event.stopPropagation(); setPreviewAsset(asset) }} style={{ cursor: 'pointer' }}>
                    {asset.kind === 'video' ? (
                      <video src={asset.image} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }} />
                    ) : (
                      asset.image && <img src={asset.image} alt={asset.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <span className="asset-type">{asset.type}</span>
                    <button className="card-menu" type="button" onClick={(event) => { event.stopPropagation(); setMenu(menu === asset.name ? null : asset.name) }} aria-label={`More options for ${asset.name}`}>...</button>
                    {menu === asset.name && (
                      <div className="menu">
                        <button type="button" onClick={(event) => { event.stopPropagation(); setMenu(null); setPreviewAsset(asset) }}>Open preview</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); renameAsset(asset) }}>Rename</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); downloadAsset(asset) }}>Download</button>
                        {activeSection === 'trash' ? (
                          <>
                            <button type="button" onClick={(event) => { event.stopPropagation(); restoreAsset(asset) }}>Restore</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); permanentlyDeleteAsset(asset) }}>Delete permanently</button>
                          </>
                        ) : (
                          <button type="button" onClick={(event) => { event.stopPropagation(); deleteAsset(asset) }}>Move to trash</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="asset-info">
                    <div>
                      <h2>{asset.name}</h2>
                      <p>{asset.size} <span>·</span> {asset.updated}</p>
                    </div>
                    {activeSection !== 'trash' && <button className={`star ${starred.includes(asset.name) ? 'starred' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); toggleStar(asset.name) }} aria-label={`Star ${asset.name}`}>{starred.includes(asset.name) ? '★' : '☆'}</button>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <strong>{activeSection === 'trash' ? 'Trash is empty' : 'No assets yet'}</strong>
              <span>{activeSection === 'trash' ? 'Deleted assets will appear here.' : 'Upload a new file to start your library.'}</span>
            </div>
          )}
        </section>
      </main>

      {notice && <div className="toast">{notice}</div>}
      {customAssetOpen && (
        <div className="modal-backdrop" onClick={() => setCustomAssetOpen(false)}>
          <div className="asset-modal create-asset-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setCustomAssetOpen(false)}>×</button>
            <div className="asset-modal-copy">
              <h3>Create custom asset</h3>
              <p>Add a new asset entry to your personal library.</p>
            </div>
            <div className="create-asset-form">
              <div className="ai-suggestions">
                <div className="ai-suggestions-header">
                  <span>AI suggestions</span>
                  <button type="button" className="ghost ai-refresh" onClick={() => requestAiSuggestions(customAssetForm.name, customAssetForm.type)}>Refresh</button>
                </div>

                {isAiLoading ? (
                  <div className="ai-suggestion-box">
                    <p>Generating asset and doodle suggestions…</p>
                  </div>
                ) : aiError ? (
                  <div className="ai-suggestion-box">
                    <p className="ai-error">{aiError}</p>
                  </div>
                ) : aiSuggestions ? (
                  <>
                    <div className="ai-suggestion-box">
                      <p><strong>Filename:</strong> {aiSuggestions.filename}</p>
                      <p><strong>Alt text:</strong> {aiSuggestions.alt_text}</p>
                      <p><strong>Caption:</strong> {aiSuggestions.caption}</p>
                      <p><strong>Tags:</strong> {aiSuggestions.tags?.join(', ')}</p>
                    </div>
                    <button
                      type="button"
                      className="upload secondary ai-apply"
                      onClick={() => setCustomAssetForm((current) => ({
                        ...current,
                        name: current.name || aiSuggestions.filename.replace(/\.[^.]+$/, ''),
                      }))}
                    >
                      Use suggested name
                    </button>
                  </>
                ) : (
                  <div className="ai-suggestion-box">
                    <p>Enter an asset name for metadata and drawing suggestions.</p>
                  </div>
                )}
              </div>
              <label>
                <span>Asset name</span>
                <input
                  value={customAssetForm.name}
                  onChange={(event) => setCustomAssetForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Campaign banner"
                />
              </label>
              <div className="create-asset-row">
                <label>
                  <span>Type</span>
                  <select
                    value={customAssetForm.type}
                    onChange={(event) => setCustomAssetForm((current) => ({ ...current, type: event.target.value }))}
                  >
                    <option value="JPG">JPG</option>
                    <option value="PNG">PNG</option>
                    <option value="MP4">MP4</option>
                    <option value="PDF">PDF</option>
                    <option value="SVG">SVG</option>
                    <option value="ZIP">ZIP</option>
                  </select>
                </label>
                <label>
                  <span>Size</span>
                  <input
                    value={customAssetForm.size}
                    onChange={(event) => setCustomAssetForm((current) => ({ ...current, size: event.target.value }))}
                    placeholder="1.2 MB"
                  />
                </label>
              </div>
              <DoodleCanvas
                onDrawingChange={setDrawingDataUrl}
                selectedIdea={selectedDrawingIdea}
                onIdeaSelect={setSelectedDrawingIdea}
                drawingIdeas={aiSuggestions?.drawing_ideas || []}
              />
              <div className="create-asset-actions">
                <button type="button" className="ghost create-cancel" onClick={() => setCustomAssetOpen(false)}>Cancel</button>
                <button type="button" className="upload create-submit" onClick={handleCreateCustomAsset}>Save asset</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {previewAsset && (
        <div className="modal-backdrop" onClick={() => setPreviewAsset(null)}>
          <div className="asset-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPreviewAsset(null)}>×</button>
            {previewAsset.kind === 'video' ? (
              <video src={previewAsset.image} controls playsInline className="asset-modal-image" />
            ) : (
              <img src={previewAsset.image} alt={previewAsset.name} className="asset-modal-image" />
            )}
            <div className="asset-modal-copy">
              <h3>{previewAsset.name}</h3>
              <p>{previewAsset.size} · {previewAsset.type}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [authMode, setAuthMode] = useState(() => window.location.pathname === '/signup' ? 'signup' : 'login')
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [authMessage, setAuthMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('dam_theme')
    return savedTheme || 'light'
  })
  const [token, setToken] = useState(() => window.localStorage.getItem('dam_token'))
  const [authStatus, setAuthStatus] = useState(() => window.localStorage.getItem('dam_token') ? 'checking' : 'unauthenticated')

  const navigateToAuthMode = useCallback((mode, replace = false) => {
    const path = mode === 'signup' ? '/signup' : '/login'
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setAuthMode(mode)
  }, [])

  const clearAuthSession = useCallback(() => {
    window.localStorage.removeItem('dam_token')
    window.localStorage.removeItem('dam_refresh_token')
    setToken(null)
    setAuthStatus('unauthenticated')
    navigateToAuthMode('login', true)
    setAuthMessage('Your session expired. Please log in again.')
  }, [navigateToAuthMode])

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = window.localStorage.getItem('dam_refresh_token')
    if (!refreshToken) {
      clearAuthSession()
      return null
    }

    const response = await fetch('/api/auth/token/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    })

    if (!response.ok) {
      clearAuthSession()
      return null
    }

    const data = await response.json()
    const nextAccessToken = data?.access

    if (!nextAccessToken) {
      clearAuthSession()
      return null
    }

    window.localStorage.setItem('dam_token', nextAccessToken)
    setToken(nextAccessToken)
    return nextAccessToken
  }, [clearAuthSession])

  const apiRequest = useCallback(async (url, options = {}, retry = true) => {
    const accessToken = window.localStorage.getItem('dam_token')
    const headers = {
      ...(options.headers || {}),
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if ((response.status === 401 || response.status === 403) && retry) {
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        return fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${refreshedToken}`,
          },
        })
      }
    }

    return response
  }, [refreshAccessToken])

  useEffect(() => {
    window.localStorage.setItem('dam_theme', theme)
  }, [theme])

  useEffect(() => {
    const syncAuthRoute = () => {
      const path = window.location.pathname
      if (!token && path !== '/login' && path !== '/signup') {
        navigateToAuthMode('login', true)
        return
      }
      if (token && (path === '/login' || path === '/signup')) {
        window.history.replaceState({}, '', '/')
        return
      }
      if (!token) setAuthMode(path === '/signup' ? 'signup' : 'login')
    }

    syncAuthRoute()
    window.addEventListener('popstate', syncAuthRoute)
    return () => window.removeEventListener('popstate', syncAuthRoute)
  }, [token, navigateToAuthMode])

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setAuthMessage('')

    try {
      const response = await fetch('/api/auth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username,
          password: authForm.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || data.non_field_errors?.[0] || 'Invalid username or password.')
      }

      if (!data.access) {
        throw new Error('Authentication token was not returned by the server.')
      }

      window.localStorage.setItem('dam_token', data.access)
      if (data.refresh) {
        window.localStorage.setItem('dam_refresh_token', data.refresh)
      }
      setToken(data.access)
      setAuthStatus('checking')
      window.history.replaceState({}, '', '/')
      setAuthForm(initialAuthForm)
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignup = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setAuthMessage('')

    try {
      const response = await fetch('/api/accounts/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username,
          email: authForm.email,
          password: authForm.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorText = data?.email?.[0] || data?.username?.[0] || data?.password?.[0] || data?.detail || 'Unable to create account.'
        throw new Error(Array.isArray(errorText) ? errorText[0] : errorText)
      }

      navigateToAuthMode('login')
      setAuthForm(initialAuthForm)
      setAuthMessage('Account created successfully. You can now log in.')
    } catch (error) {
      setAuthMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const handleLogout = () => {
    window.localStorage.removeItem('dam_token')
    window.localStorage.removeItem('dam_refresh_token')
    setToken(null)
    setAuthStatus('unauthenticated')
    navigateToAuthMode('login', true)
    setAuthMessage('You have been signed out.')
  }

  useEffect(() => {
    if (!token) return

    // Session validation may refresh tokens and clear invalid auth state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    apiRequest('/api/accounts/me/', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (response.status === 401 || response.status === 403) {
          clearAuthSession()
          return
        }
        if (!response.ok) throw new Error('Unable to validate session.')
        setAuthStatus('authenticated')
      })
      .catch(() => {
        clearAuthSession()
      })
  }, [token, apiRequest, clearAuthSession])

  if (token && authStatus === 'checking') {
    return <div className={`session-checking theme-${theme}`} role="status">Checking your session…</div>
  }

  if (!token || authStatus !== 'authenticated') {
    return (
      <AuthView
        authMode={authMode}
        setAuthMode={navigateToAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        isSubmitting={isSubmitting}
        authMessage={authMessage}
        onLogin={handleLogin}
        onSignup={handleSignup}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    )
  }

  return <DashboardApp onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} apiRequest={apiRequest} />
}

export default App
