import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
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
  file_url: asset.file_url || null,
  thumbnail_url: asset.thumbnail_url || null,
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

function DashboardApp({ onLogout, theme, toggleTheme, apiRequest, workspaces, currentWorkspace, switchWorkspace, createWorkspace }) {
  const [assets, setAssets] = useState(emptyAssets)
  const [trashAssets, setTrashAssets] = useState(emptyAssets)
  const [collections, setCollections] = useState(emptyAssets)
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [assetToCollect, setAssetToCollect] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState([])
  const [starredByWorkspace, setStarredByWorkspace] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('dam_favorites_by_workspace') || '{}')
    } catch {
      return {}
    }
  })
  const starred = starredByWorkspace[currentWorkspace?.id] || []
  const [activities, setActivities] = useState([])
  const [notice, setNotice] = useState('')
  const [uploadItems, setUploadItems] = useState([])
  const [menu, setMenu] = useState(null)
  const [previewAsset, setPreviewAsset] = useState(null)
  const previewObjectUrl = useRef(null)
  const previewRequest = useRef(0)
  const activeWorkspaceRole = currentWorkspace?.role || 'viewer'
  const canManageWorkspace = ['admin', 'editor'].includes(activeWorkspaceRole)
  const [customAssetOpen, setCustomAssetOpen] = useState(false)
  const [customAssetForm, setCustomAssetForm] = useState(initialCustomAssetForm)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [drawingDataUrl, setDrawingDataUrl] = useState('')
  const [selectedDrawingIdea, setSelectedDrawingIdea] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const fileInput = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const workspacePath = (path) => `/workspaces/${currentWorkspace?.id || ''}${path === '/' ? '/assets' : path}`

  const closeAssetPreview = useCallback(() => {
    previewRequest.current += 1
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    previewObjectUrl.current = null
    setPreviewAsset(null)
  }, [])

  const openAssetPreview = useCallback(async (asset) => {
    const requestId = previewRequest.current + 1
    previewRequest.current = requestId
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    previewObjectUrl.current = null
    setPreviewAsset({ ...asset, previewLoading: Boolean(asset.file_url) })
    if (!asset.file_url) return

    try {
      const response = await apiRequest(asset.file_url)
      if (!response.ok) throw new Error('Unable to load this file preview.')
      const blobUrl = URL.createObjectURL(await response.blob())
      if (previewRequest.current !== requestId) {
        URL.revokeObjectURL(blobUrl)
        return
      }
      previewObjectUrl.current = blobUrl
      setPreviewAsset((current) => current?.id === asset.id ? { ...current, image: blobUrl, previewLoading: false } : current)
    } catch (error) {
      if (previewRequest.current === requestId) {
        setPreviewAsset((current) => current?.id === asset.id ? { ...current, previewLoading: false } : current)
        setNotice(error.message || 'Unable to load this file preview.')
        setMenu(null)
      }
    }
  }, [apiRequest])

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

    if (!currentWorkspace?.id) return

    let cancelled = false
    apiRequest('/api/assets/', { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (!cancelled) setAssets(Array.isArray(data) ? data.map(mapApiAsset) : []) })
      .catch(() => { if (!cancelled) setAssets([]) })

    apiRequest('/api/assets/trash/', { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (!cancelled) setTrashAssets(Array.isArray(data) ? data.map(mapApiAsset) : []) })
      .catch(() => { if (!cancelled) setTrashAssets([]) })

    apiRequest('/api/collections/', { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (!cancelled) setCollections(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setCollections([]) })

    return () => { cancelled = true }
  }, [apiRequest, currentWorkspace?.id])

  const protectedFileUrls = [...assets, ...trashAssets, ...collections.flatMap((collection) => collection.assets || [])]
    .map((asset) => asset.thumbnail_url)
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .sort()
  const protectedFileKey = protectedFileUrls.join('\n')

  useEffect(() => {
    if (!protectedFileKey) return undefined
    let cancelled = false
    const objectUrls = []

    Promise.all(protectedFileKey.split('\n').map(async (url) => {
      try {
        const response = await apiRequest(url)
        if (!response.ok) return null
        const blobUrl = URL.createObjectURL(await response.blob())
        objectUrls.push(blobUrl)
        return [url, blobUrl]
      } catch {
        return null
      }
    })).then((entries) => {
      if (cancelled) return
      const previews = new Map(entries.filter(Boolean))
      const attachPreview = (asset) => previews.has(asset.thumbnail_url)
        ? { ...asset, image: previews.get(asset.thumbnail_url) }
        : asset
      setAssets((current) => current.map(attachPreview))
      setTrashAssets((current) => current.map(attachPreview))
      setCollections((current) => current.map((collection) => ({
        ...collection,
        assets: (collection.assets || []).map(attachPreview),
      })))
    })

    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [apiRequest, currentWorkspace?.id, protectedFileKey])

  const openCollections = async () => {
    navigate(workspacePath('/collections'))
    try {
      const response = await apiRequest('/api/collections/')
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'Unable to load collections.')
      setCollections(Array.isArray(data) ? data : [])
    } catch (error) {
      showNotice(error.message || 'Unable to load collections.')
    }
  }

  const createCollection = async (event) => {
    event.preventDefault()
    const name = collectionName.trim()
    if (!name) return
    try {
      const response = await apiRequest('/api/collections/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.name?.[0] || data?.detail || 'Unable to create collection.')
      setCollections((current) => [data, ...current])
      setCollectionName('')
      setIsCreateCollectionOpen(false)
      showNotice(`Collection “${data.name}” created.`)
    } catch (error) {
      showNotice(error.message || 'Unable to create collection.')
    }
  }

  const addAssetToCollection = async (collection) => {
    if (!assetToCollect?.id || !/^[0-9a-f-]{36}$/i.test(assetToCollect.id)) {
      showNotice('Only saved assets can be added to a collection.')
      setAssetToCollect(null)
      return
    }
    try {
      const response = await apiRequest(`/api/collections/${collection.id}/assets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_ids: [assetToCollect.id] }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || data?.asset_ids || 'Unable to add this asset.')
      setCollections((current) => current.map((item) => item.id === data.id ? data : item))
      setAssetToCollect(null)
      showNotice(`${assetToCollect.name} added to ${data.name}.`)
    } catch (error) {
      showNotice(error.message || 'Unable to add this asset.')
    }
  }

  const removeAssetFromCollection = async (asset) => {
    if (!activeCollection) return
    try {
      const response = await apiRequest(`/api/collections/${activeCollection.id}/remove-asset/?asset_id=${asset.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'Unable to remove this media from the collection.')
      setCollections((current) => current.map((item) => item.id === data.id ? data : item))
      showNotice(`${asset.name} removed from ${data.name}.`)
    } catch (error) {
      showNotice(error.message || 'Unable to remove this media from the collection.')
    }
  }

  const openTrash = async () => {
    navigate(workspacePath('/trash'))
    try {
      const response = await apiRequest('/api/assets/trash/')
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'Unable to load the trash.')
      setTrashAssets(Array.isArray(data) ? data.map(mapApiAsset) : [])
    } catch (error) {
      showNotice(error.message || 'Unable to load the trash.')
    }
  }

  const routeState = useMemo(() => {
    const path = (location.pathname || '/').replace(/^\/workspaces\/[^/]+/, '') || '/assets'

    if (path === '/' || path === '/assets' || path === '') {
      return { activeSection: 'assets', activeCollectionId: null }
    }

    if (path === '/collections' || path === '/collection') {
      return { activeSection: 'collections', activeCollectionId: null }
    }

    if (path === '/trash') {
      return { activeSection: 'trash', activeCollectionId: null }
    }

    if (path === '/activity') {
      return { activeSection: 'activity', activeCollectionId: null }
    }

    if (path.startsWith('/collections/') || path.startsWith('/collection/')) {
      const collectionId = path.replace(/^\/collections?\//, '').split('/')[0]
      return { activeSection: 'collection', activeCollectionId: collectionId || null }
    }

    return { activeSection: 'assets', activeCollectionId: null }
  }, [location.pathname])

  const activeSection = routeState.activeSection
  const activeCollectionId = routeState.activeCollectionId

  useEffect(() => {
    window.localStorage.setItem('dam_favorites_by_workspace', JSON.stringify(starredByWorkspace))
  }, [starredByWorkspace])

  useEffect(() => {
    if (!currentWorkspace?.id) return undefined
    let cancelled = false
    let knownActivityIds = null
    let timer

    const refreshActivity = async () => {
      try {
        const response = await apiRequest('/api/tenants/activity/')
        if (!response.ok) return
        const data = await response.json()
        if (cancelled || !Array.isArray(data)) return

        if (knownActivityIds) {
          const newActivities = data.filter((activity) => !knownActivityIds.has(activity.id))
          if (newActivities.length) {
            const latestActivity = newActivities[0]
            const prefix = newActivities.length > 1 ? `${newActivities.length} new activities: ` : 'New activity: '
            setNotice(`${prefix}${latestActivity.message}`)
            setMenu(null)
          }
        }

        knownActivityIds = new Set(data.map((activity) => activity.id))
        setActivities(data)
      } catch {
        // Keep the last activity list and retry on the next polling cycle.
      } finally {
        if (!cancelled) timer = window.setTimeout(refreshActivity, 15000)
      }
    }

    refreshActivity()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [apiRequest, currentWorkspace?.id])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeAssetPreview()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeAssetPreview])

  const activeCollection = collections.find((collection) => collection.id === activeCollectionId)
  const collectionAssets = (activeCollection?.assets || []).map((asset, index) => {
    const savedAsset = assets.find((item) => item.id === asset.id)
    return savedAsset || mapApiAsset(asset, index)
  })
  const getCollectionThumbnails = (collection) => {
    const collectionAssets = (collection?.assets || []).map(
      (asset) => assets.find((item) => item.id === asset.id) || mapApiAsset(asset),
    )
    const imageAssets = collectionAssets.filter((asset) => asset.kind === 'image')
    const visibleImages = imageAssets.slice(0, 4)

    return {
      imageAssets: visibleImages,
      imageCount: imageAssets.length,
      remainingCount: Math.max(0, imageAssets.length - visibleImages.length),
    }
  }
  const currentAssets = activeSection === 'trash'
    ? trashAssets
    : activeSection === 'collection'
      ? collectionAssets
      : assets
  const visibleAssets = useMemo(() => {
    const filtered = currentAssets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || asset.type === filter))
    return [...filtered].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : 0))
  }, [currentAssets, filter, query, sort])

  const totalAssetCount = assets.length
  const favoriteAssets = assets.filter((asset) => starred.includes(asset.name))

  const updateStarred = (update) => setStarredByWorkspace((current) => {
    const workspaceId = currentWorkspace?.id
    if (!workspaceId) return current
    const currentNames = current[workspaceId] || []
    const nextNames = typeof update === 'function' ? update(currentNames) : update
    return { ...current, [workspaceId]: nextNames }
  })
  const toggleStar = (name) => updateStarred((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const showNotice = (message) => {
    setNotice(message)
    setMenu(null)
  }

  const handleCreateWorkspace = async () => {
    const name = window.prompt('Name your new workspace')?.trim()
    if (!name) return
    try {
      await createWorkspace(name)
      showNotice(`Workspace “${name}” created.`)
    } catch (error) {
      showNotice(error.message || 'Unable to create workspace.')
    }
  }

  const downloadAsset = async (asset) => {
    const sourceUrl = asset?.download_url || asset?.file_url || asset?.image || asset?.url
    if (!sourceUrl) {
      showNotice(`No downloadable file found for ${asset?.name || 'this asset'}.`)
      return
    }

    try {
      const response = await apiRequest(sourceUrl)

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
      updateStarred((current) => current.filter((item) => item !== asset.name))
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

  const renameAsset = async (asset) => {
    const newName = window.prompt('Rename asset', asset.name)?.trim()
    if (!newName || newName === asset.name) {
      setMenu(null)
      return
    }

    try {
      if (/^[0-9a-f-]{36}$/i.test(asset.id || '')) {
        const response = await apiRequest(`/api/assets/${asset.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.name?.[0] || errorData?.detail || 'Unable to rename this asset.')
        }
      }
      setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, name: newName } : item))
      setTrashAssets((current) => current.map((item) => item.id === asset.id ? { ...item, name: newName } : item))
      setCollections((current) => current.map((collection) => ({
        ...collection,
        assets: (collection.assets || []).map((item) => item.id === asset.id ? { ...item, name: newName } : item),
      })))
    } catch (error) {
      showNotice(error.message || 'Unable to rename this asset.')
      return
    }
    setSelected((current) => current.map((item) => item === asset.name ? newName : item))
    updateStarred((current) => current.map((item) => item === asset.name ? newName : item))
    if (previewAsset?.name === asset.name) setPreviewAsset({ ...previewAsset, name: newName })
    showNotice(`${asset.name} renamed to ${newName}.`)
  }

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    event.target.value = ''
    const queue = files.map((file) => ({ id: crypto.randomUUID(), file, name: file.name }))
    setUploadItems((current) => [...queue.map(({ id, name }) => ({ id, name, progress: 0, status: 'queued' })), ...current])

    const uploadOne = ({ id, file }) => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      xhr.open('POST', '/api/assets/upload/')
      const token = window.localStorage.getItem('dam_token')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.addEventListener('progress', (progressEvent) => {
        const progress = progressEvent.lengthComputable
          ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
          : null
        setUploadItems((current) => current.map((item) => item.id === id ? { ...item, progress, status: 'uploading' } : item))
      })
      xhr.addEventListener('load', () => {
        let data = {}
        try { data = JSON.parse(xhr.responseText) } catch { /* The server returned no JSON body. */ }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data?.file?.[0] || data?.detail || 'Upload failed.'))
          return
        }
        resolve(data)
      })
      xhr.addEventListener('error', () => reject(new Error('Network error while uploading the file.')))
      xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled.')))
      xhr.send(formData)
    })

    const results = await Promise.all(queue.map(async (item) => {
      try {
        const data = await uploadOne(item)
        const asset = mapApiAsset(data)
        setAssets((current) => [asset, ...current.filter((existing) => existing.id !== asset.id)])
        setUploadItems((current) => current.map((upload) => upload.id === item.id ? { ...upload, progress: 100, status: 'complete' } : upload))
        return { ok: true, name: item.name }
      } catch (error) {
        setUploadItems((current) => current.map((upload) => upload.id === item.id ? { ...upload, status: 'error', error: error.message } : upload))
        return { ok: false, name: item.name, error: error.message }
      }
    }))

    const completed = results.filter((result) => result.ok).length
    const failures = results.length - completed
    showNotice(failures ? `${completed} uploaded, ${failures} failed.` : `${completed} file${completed === 1 ? '' : 's'} uploaded.`)
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
        <div className="workspace-switcher">
          <label htmlFor="workspace-switcher">Workspace</label>
          <select id="workspace-switcher" value={currentWorkspace?.id || ''} onChange={(event) => switchWorkspace(event.target.value)}>
            {(workspaces.length ? workspaces : [{ id: currentWorkspace?.id || '', name: currentWorkspace?.name || 'Current workspace', role: activeWorkspaceRole }]).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          <small>{activeWorkspaceRole}</small>
          <button className="workspace-create" type="button" onClick={handleCreateWorkspace}>+ New workspace</button>
        </div>
        <nav>
          <p className="nav-label">Workspace</p>
          <button className={activeSection === 'assets' ? 'active' : ''} type="button" onClick={() => navigate(workspacePath('/assets'))}><span>▦</span> All assets <b>{totalAssetCount}</b></button>
          <button className={activeSection === 'collections' || activeSection === 'collection' ? 'active' : ''} type="button" onClick={openCollections}><span>□</span> Collections <b>{collections.length}</b></button>
          <button className={activeSection === 'trash' ? 'active' : ''} type="button" onClick={openTrash}><span>⌫</span> Trash <b>{trashAssets.length}</b></button>
          <p className="nav-label second">Manage</p>
          <button className={activeSection === 'activity' ? 'active' : ''} type="button" onClick={() => navigate(workspacePath('/activity'))}><span>◷</span> Activity <b>{activities.length}</b></button>
          <div className="favorites-panel">
            <div className="favorites-heading"><span>Favorites</span><b>{favoriteAssets.length}</b></div>
            {favoriteAssets.length ? favoriteAssets.map((asset) => (
              <div className="favorite-item" key={asset.name} onClick={() => openAssetPreview(asset)}>
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
          <div className="breadcrumbs"><span>Library</span><b>/</b><strong>{activeSection === 'trash' ? 'Trash' : activeSection === 'collections' ? 'Collections' : activeSection === 'collection' ? activeCollection?.name || 'Collection' : activeSection === 'activity' ? 'Activity' : 'All assets'}</strong></div>
          <div className="top-actions">
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="icon-button" type="button" onClick={() => showNotice('You are all caught up.')} aria-label="Notifications">o</button>
            <input ref={fileInput} type="file" multiple hidden accept=".jpg,.jpeg,.png,.gif,.webp,.avif,.mp4,.webm,.mov,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleFiles} />
            {activeSection === 'collections' && canManageWorkspace && <button className="upload secondary" type="button" onClick={() => setIsCreateCollectionOpen(true)}>+ Create collection</button>}
            {activeSection !== 'collections' && activeSection !== 'collection' && canManageWorkspace && <>
              <button className="upload secondary" type="button" onClick={() => { setDrawingDataUrl(''); setSelectedDrawingIdea(''); setCustomAssetOpen(true) }}>+ Create asset</button>
              <button className="upload" type="button" onClick={() => fileInput.current?.click()}>+ Upload assets</button>
            </>}
          </div>
        </header>

        {uploadItems.length > 0 && <div className="upload-queue" aria-live="polite">
          <div className="upload-queue-heading">
            <strong>Uploads</strong>
            <button type="button" onClick={() => setUploadItems((current) => current.filter((item) => item.status === 'queued' || item.status === 'uploading'))}>Clear finished</button>
          </div>
          {uploadItems.slice(0, 5).map((item) => (
            <div className="upload-queue-item" key={item.id}>
              <div className="upload-queue-copy"><span title={item.name}>{item.name}</span><small>{item.status === 'error' ? item.error : item.progress == null ? item.status : `${item.status} · ${item.progress}%`}</small></div>
              <progress max="100" value={item.progress ?? 0} aria-label={`${item.name} upload progress`} />
            </div>
          ))}
          {uploadItems.length > 5 && <small className="upload-queue-more">and {uploadItems.length - 5} more…</small>}
        </div>}

        <section className="content" id="assets">
          <div className="title-row">
            <div>
              <p className="eyebrow">{activeSection === 'activity' ? 'LIVE UPDATES' : activeSection === 'collections' || activeSection === 'collection' ? 'ORGANIZE' : 'LIBRARY'}</p>
              <h1>{activeSection === 'trash' ? 'Trash' : activeSection === 'collections' ? 'Collections' : activeSection === 'collection' ? activeCollection?.name || 'Collection' : activeSection === 'activity' ? 'Activity' : 'All assets'} <span>{activeSection === 'trash' ? trashAssets.length : activeSection === 'collections' ? collections.length : activeSection === 'collection' ? collectionAssets.length : activeSection === 'activity' ? activities.length : totalAssetCount}</span></h1>
              <p className="intro">{activeSection === 'trash' ? 'Deleted assets stay here until you restore or permanently delete them.' : activeSection === 'collections' ? 'Group related media together in collections.' : activeSection === 'collection' ? 'Media saved in this collection.' : activeSection === 'activity' ? 'Live updates from actions happening in your workspace.' : 'Your asset library is empty until you upload files.'}</p>
            </div>
            {activeSection !== 'collections' && activeSection !== 'activity' && <button className="ghost" type="button" onClick={() => setSelected(selected.length ? [] : visibleAssets.map((asset) => asset.name))}>{selected.length ? `Clear (${selected.length})` : 'Select all'}</button>}
          </div>

          {activeSection !== 'collections' && activeSection !== 'activity' && <div className="toolbar">
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
          </div>}

          {activeSection !== 'collections' && activeSection !== 'activity' && <div className="summary">
            <span><b>{visibleAssets.length}</b> assets shown</span>
            <span className="dot-separator" />
            <span>{selected.length ? `${selected.length} selected` : `${totalAssetCount} total`}</span>
            <span className="summary-spacer" />
            <span className="sync">● {totalAssetCount > 0 ? 'Library active' : 'No files yet'}</span>
          </div>}

          {activeSection === 'activity' ? (
            activities.length ? (
              <div className="activity-feed">
                {activities.map((activity) => (
                  <article className="activity-item" key={activity.id}>
                    <span className={`activity-icon ${activity.type}`}>{activity.type === 'error' ? '!' : '◷'}</span>
                    <div>
                      <p>{activity.message}</p>
                      <time>{activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Just now'}</time>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty activity-empty"><strong>No activity yet</strong><span>Actions in your workspace will appear here in real time.</span></div>
            )
          ) : activeSection === 'collections' ? (
            collections.length ? (
              <div className="collection-grid">
                {collections.map((collection) => {
                  const { imageAssets, imageCount, remainingCount } = getCollectionThumbnails(collection)
                  return (
                    <button className="collection-card" type="button" key={collection.id} onClick={() => navigate(workspacePath(`/collections/${collection.id}`))}>
                      <span className="collection-thumbnails" aria-label={`${imageCount} collection images`}>
                        {imageAssets.length ? imageAssets.map((asset) => (
                          <span className="collection-thumbnail" key={asset.id}>
                            <img src={asset.image} alt={asset.name} loading="lazy" />
                          </span>
                        )) : <span className="collection-thumbnail-empty">□</span>}
                        {remainingCount > 0 && <span className="collection-thumbnail-more">+{remainingCount}</span>}
                      </span>
                      <strong>{collection.name}</strong>
                      <span>{collection.assets?.length || 0} media</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="empty"><strong>No collections yet</strong><span>Create a collection to start organizing media.</span></div>
            )
          ) : visibleAssets.length ? (
            <div className={`asset-grid ${view === 'list' ? 'list-view' : ''}`}>
              {visibleAssets.map((asset, index) => (
                <article
                  className={`asset-card ${selected.includes(asset.name) ? 'selected' : ''}`}
                  key={asset.id ?? `${asset.name}-${asset.updated}-${index}`}
                  onClick={(event) => {
                    if (event.target.closest('button')) return
                    openAssetPreview(asset)
                  }}
                >
                  <div className={`asset-preview ${asset.color}`} onClick={(event) => { event.stopPropagation(); openAssetPreview(asset) }} style={{ cursor: 'pointer' }}>
                    {asset.kind === 'video' ? (
                      <button className="video-thumbnail" type="button" onClick={(event) => { event.stopPropagation(); openAssetPreview(asset) }} aria-label={`Preview video ${asset.name}`}>
                        <img src={asset.image} alt="" />
                        <span aria-hidden="true">▶</span>
                      </button>
                    ) : (
                      asset.image && <img src={asset.image} alt={asset.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <span className="asset-type">{asset.type}</span>
                    <button className="card-menu" type="button" onClick={(event) => { event.stopPropagation(); setMenu(menu === asset.name ? null : asset.name) }} aria-label={`More options for ${asset.name}`}>...</button>
                    {menu === asset.name && (
                      <div className="menu">
                        <button type="button" onClick={(event) => { event.stopPropagation(); setMenu(null); openAssetPreview(asset) }}>Open preview</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); downloadAsset(asset) }}>Download</button>
                        {canManageWorkspace && activeSection !== 'trash' && <button type="button" onClick={(event) => { event.stopPropagation(); renameAsset(asset) }}>Rename</button>}
                        {activeSection === 'trash' ? (
                          canManageWorkspace && <>
                            <button type="button" onClick={(event) => { event.stopPropagation(); restoreAsset(asset) }}>Restore</button>
                            {activeWorkspaceRole === 'admin' && <button type="button" onClick={(event) => { event.stopPropagation(); permanentlyDeleteAsset(asset) }}>Delete permanently</button>}
                          </>
                        ) : activeSection === 'collection' ? (
                          canManageWorkspace && <button type="button" onClick={(event) => { event.stopPropagation(); removeAssetFromCollection(asset) }}>Remove from collection</button>
                        ) : (
                          canManageWorkspace && <>
                            <button type="button" onClick={(event) => { event.stopPropagation(); setAssetToCollect(asset); setMenu(null) }}>Add to collection</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); deleteAsset(asset) }}>Move to trash</button>
                          </>
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

      {notice && <div className="toast" role="status" aria-live="polite">
        <span>{notice}</span>
        <button className="toast-dismiss" type="button" onClick={() => setNotice('')} aria-label="Dismiss notification" title="Dismiss notification">Dismiss ×</button>
      </div>}
      {isCreateCollectionOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateCollectionOpen(false)}>
          <form className="asset-modal collection-modal" onSubmit={createCollection} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setIsCreateCollectionOpen(false)}>×</button>
            <div className="asset-modal-copy">
              <h3>Create a collection</h3>
              <p>Give this collection a name. You can add media to it from the asset menu.</p>
            </div>
            <label>
              <span>Collection name</span>
              <input autoFocus maxLength={200} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Campaigns" required />
            </label>
            <div className="create-asset-actions">
              <button type="button" className="ghost create-cancel" onClick={() => setIsCreateCollectionOpen(false)}>Cancel</button>
              <button type="submit" className="upload create-submit">Create collection</button>
            </div>
          </form>
        </div>
      )}
      {assetToCollect && (
        <div className="modal-backdrop" onClick={() => setAssetToCollect(null)}>
          <div className="asset-modal collection-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setAssetToCollect(null)}>×</button>
            <div className="asset-modal-copy">
              <h3>Add to collection</h3>
              <p>Choose a collection for {assetToCollect.name}.</p>
            </div>
            {collections.length ? (
              <div className="collection-picker">
                {collections.map((collection) => (
                  <button type="button" key={collection.id} onClick={() => addAssetToCollection(collection)}>
                    <span>□</span>{collection.name}<b>{collection.assets?.length || 0}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty collection-picker-empty"><strong>No collections yet</strong><span>Create one from the Collections section first.</span></div>
            )}
          </div>
        </div>
      )}
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
        <div className="modal-backdrop" onClick={closeAssetPreview}>
          <div className="asset-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={closeAssetPreview}>×</button>
            {previewAsset.previewLoading ? (
              <div className="asset-preview-loading" role="status">Loading original file…</div>
            ) : previewAsset.kind === 'video' ? (
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
  const location = useLocation()
  const navigate = useNavigate()
  const requestedWorkspaceId = location.pathname.match(/^\/workspaces\/([^/]+)/)?.[1]
  const authMode = location.pathname === '/signup' ? 'signup' : 'login'
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [authMessage, setAuthMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('dam_theme')
    return savedTheme || 'light'
  })
  const [token, setToken] = useState(() => window.localStorage.getItem('dam_token'))
  const [workspaces, setWorkspaces] = useState([])
  const [currentWorkspace, setCurrentWorkspace] = useState(null)
  const [authStatus, setAuthStatus] = useState(() => window.localStorage.getItem('dam_token') ? 'checking' : 'unauthenticated')

  const navigateToAuthMode = useCallback((mode, replace = false) => {
    const path = mode === 'signup' ? '/signup' : '/login'
    navigate(path, { replace })
  }, [navigate])

  const clearAuthSession = useCallback(() => {
    window.localStorage.removeItem('dam_token')
    window.localStorage.removeItem('dam_refresh_token')
    setToken(null)
    setWorkspaces([])
    setCurrentWorkspace(null)
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

    if (response.status === 401 && retry) {
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

  const switchWorkspace = useCallback(async (workspaceId) => {
    if (!workspaceId) return

    try {
      const response = await apiRequest('/api/tenants/switch/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Unable to switch workspace.')
      }

      const nextWorkspace = await response.json()
      setCurrentWorkspace(nextWorkspace)
      setWorkspaces((current) => current.map((workspace) => workspace.id === nextWorkspace.id ? nextWorkspace : workspace))
      const currentSuffix = location.pathname.match(/^\/workspaces\/[^/]+(\/.*)?$/)?.[1] || '/assets'
      navigate(`/workspaces/${workspaceId}${currentSuffix}`, { replace: false })
    } catch (error) {
      setAuthMessage(error.message || 'Unable to switch workspace.')
    }
  }, [apiRequest, location.pathname, navigate])

  const createWorkspace = useCallback(async (name) => {
    const slugBase = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workspace'
    const response = await apiRequest('/api/tenants/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}` }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = data?.slug?.[0] || data?.name?.[0] || data?.detail || 'Unable to create workspace.'
      throw new Error(detail)
    }
    const workspace = { ...data, role: 'admin' }
    setWorkspaces((current) => [...current.filter((item) => item.id !== workspace.id), workspace])
    setCurrentWorkspace(workspace)
    navigate(`/workspaces/${workspace.id}/assets`)
    return workspace
  }, [apiRequest, navigate])

  useEffect(() => {
    window.localStorage.setItem('dam_theme', theme)
  }, [theme])

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
    setWorkspaces([])
    setCurrentWorkspace(null)
    setAuthStatus('unauthenticated')
    navigateToAuthMode('login', true)
    setAuthMessage('You have been signed out.')
  }

  useEffect(() => {
    if (!token) return

    // Session validation may refresh tokens and clear invalid auth state.
    let cancelled = false
    const loadWorkspaceSession = async () => {
      try {
        const userResponse = await apiRequest('/api/accounts/me/', { headers: { Authorization: `Bearer ${token}` } })
        if (userResponse.status === 401 || userResponse.status === 403) {
          if (!cancelled) clearAuthSession()
          return
        }
        if (!userResponse.ok) throw new Error('Unable to validate session.')

        const workspacesResponse = await apiRequest('/api/tenants/')
        if (!workspacesResponse.ok) throw new Error('Unable to load workspaces.')
        const workspaceData = await workspacesResponse.json()
        if (!Array.isArray(workspaceData)) throw new Error('Invalid workspace response.')
        if (cancelled) return

        const requestedWorkspace = workspaceData.find((workspace) => workspace.id === requestedWorkspaceId)
        const nextWorkspace = requestedWorkspace || workspaceData[0] || null
        if (!nextWorkspace) throw new Error('No workspace is available for this account.')

        if (!requestedWorkspace || !requestedWorkspaceId) {
          navigate(`/workspaces/${nextWorkspace.id}/assets`, { replace: true })
        }

        const switchResponse = await apiRequest('/api/tenants/switch/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: nextWorkspace.id }),
        })
        if (!switchResponse.ok) throw new Error('Unable to activate the requested workspace.')
        const activatedWorkspace = await switchResponse.json()
        const workspaceIndex = workspaceData.findIndex((workspace) => workspace.id === activatedWorkspace.id)
        if (workspaceIndex >= 0) workspaceData[workspaceIndex] = activatedWorkspace

        if (cancelled) return
        setWorkspaces(workspaceData)
        setCurrentWorkspace(activatedWorkspace)
        setAuthStatus('authenticated')
      } catch (error) {
        if (!cancelled) {
          setAuthMessage(error.message || 'Unable to load your workspace.')
          clearAuthSession()
        }
      }
    }

    loadWorkspaceSession()
    return () => { cancelled = true }
  }, [token, apiRequest, clearAuthSession, requestedWorkspaceId, navigate])

  if (token && (authStatus === 'checking' || (requestedWorkspaceId && currentWorkspace?.id !== requestedWorkspaceId))) {
    return <div className={`session-checking theme-${theme}`} role="status">{authStatus === 'checking' ? 'Checking your session…' : 'Switching workspace…'}</div>
  }

  if (!token || authStatus !== 'authenticated') {
    if (!token && location.pathname !== '/login' && location.pathname !== '/signup') {
      return <Navigate to="/login" replace />
    }
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

  return <DashboardApp key={currentWorkspace.id} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} apiRequest={apiRequest} workspaces={workspaces} currentWorkspace={currentWorkspace} switchWorkspace={switchWorkspace} createWorkspace={createWorkspace} />
}

export default App
