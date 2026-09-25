import { useEffect, useMemo, useRef, useState } from 'react'
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

const initialAuthForm = {
  username: '',
  password: '',
}

const initialCustomAssetForm = {
  name: '',
  type: 'JPG',
  size: '1.2 MB',
}

function AuthView({ authMode, setAuthMode, authForm, setAuthForm, isSubmitting, setAuthMessage, authMessage, onLogin, onSignup, theme, toggleTheme }) {
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

function DashboardApp({ onLogout, theme, toggleTheme }) {
  const [assets, setAssets] = useState(emptyAssets)
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
  const fileInput = useRef(null)

  useEffect(() => {
    const token = window.localStorage.getItem('dam_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    fetch('/api/assets/', { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => setAssets([]))
  }, [])

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

  const visibleAssets = useMemo(() => {
    const filtered = assets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || asset.type === filter))
    return [...filtered].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : 0))
  }, [assets, filter, query, sort])

  const totalAssetCount = assets.length
  const favoriteAssets = assets.filter((asset) => starred.includes(asset.name))

  const toggleSelection = (name) => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const toggleStar = (name) => setStarred((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const showNotice = (message) => {
    setNotice(message)
    setMenu(null)
  }

  const deleteAsset = (name) => {
    setAssets((current) => current.filter((asset) => asset.name !== name))
    setSelected((current) => current.filter((item) => item !== name))
    setStarred((current) => current.filter((item) => item !== name))
    showNotice(`${name} deleted.`)
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

  const handleCreateCustomAsset = () => {
    const trimmedName = customAssetForm.name.trim()
    if (!trimmedName) {
      showNotice('Asset name is required.')
      return
    }

    const type = customAssetForm.type.toUpperCase()
    const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(type)
    const isVideo = ['MP4', 'MOV', 'WEBM', 'AVI', 'MKV'].includes(type)

    const newAsset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      type,
      kind: isImage ? 'image' : isVideo ? 'video' : 'file',
      size: customAssetForm.size || 'Custom',
      color: ['coral', 'blue', 'green', 'yellow'][Math.floor(Math.random() * 4)],
      updated: 'Just now',
      image: getPlaceholderImage(trimmedName),
    }

    setAssets((current) => [newAsset, ...current])
    setCustomAssetOpen(false)
    setCustomAssetForm(initialCustomAssetForm)
    showNotice(`${trimmedName} created successfully.`)
  }

  return (
    <div className={`shell theme-${theme}`} onClick={() => menu && setMenu(null)}>
      <aside className="sidebar">
        <div className="wordmark">Digital Asset</div>
        <nav>
          <p className="nav-label">Workspace</p>
          <button className="active" type="button" onClick={() => showNotice('Showing all assets')}><span>▦</span> All assets <b>{totalAssetCount}</b></button>
          <button type="button" onClick={() => showNotice('Collections view is coming next.')}><span>□</span> Collections</button>
          <button type="button" onClick={() => showNotice('No shared assets yet.')}><span>↗</span> Shared with me</button>
          <button type="button" onClick={() => showNotice('Trash is empty.')}><span>⌫</span> Trash</button>
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
          <div className="breadcrumbs"><span>Library</span><b>/</b><strong>All assets</strong></div>
          <div className="top-actions">
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="icon-button" type="button" onClick={() => showNotice('You are all caught up.')} aria-label="Notifications">o</button>
            <input ref={fileInput} type="file" multiple hidden onChange={handleFiles} />
            <button className="upload secondary" type="button" onClick={() => setCustomAssetOpen(true)}>+ Create asset</button>
            <button className="upload" type="button" onClick={() => fileInput.current?.click()}>+ Upload assets</button>
          </div>
        </header>

        <section className="content" id="assets">
          <div className="title-row">
            <div>
              <p className="eyebrow">LIBRARY</p>
              <h1>All assets <span>{totalAssetCount}</span></h1>
              <p className="intro">Your asset library is empty until you upload files.</p>
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
                        <button type="button" onClick={(event) => { event.stopPropagation(); showNotice(`${asset.name} opened.`) }}>Open preview</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); renameAsset(asset) }}>Rename</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); showNotice(`${asset.name} download queued.`) }}>Download</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); deleteAsset(asset.name) }}>Delete</button>
                      </div>
                    )}
                  </div>
                  <div className="asset-info">
                    <div>
                      <h2>{asset.name}</h2>
                      <p>{asset.size} <span>·</span> {asset.updated}</p>
                    </div>
                    <button className={`star ${starred.includes(asset.name) ? 'starred' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); toggleStar(asset.name) }} aria-label={`Star ${asset.name}`}>{starred.includes(asset.name) ? '★' : '☆'}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty"><strong>No assets yet</strong><span>Upload a new file to start your library.</span></div>
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
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [authMessage, setAuthMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('dam_theme')
    return savedTheme || 'light'
  })
  const [token, setToken] = useState(() => window.localStorage.getItem('dam_token'))

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

      window.localStorage.setItem('dam_token', data.access)
      setToken(data.access)
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
          password: authForm.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorText = data?.email?.[0] || data?.username?.[0] || data?.password?.[0] || data?.detail || 'Unable to create account.'
        throw new Error(Array.isArray(errorText) ? errorText[0] : errorText)
      }

      setAuthMode('login')
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
    setToken(null)
    setAuthMode('login')
    setAuthMessage('You have been signed out.')
  }

  if (!token) {
    return (
      <AuthView
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        isSubmitting={isSubmitting}
        authMessage={authMessage}
        setAuthMessage={setAuthMessage}
        onLogin={handleLogin}
        onSignup={handleSignup}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    )
  }

  return <DashboardApp onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
}

export default App
