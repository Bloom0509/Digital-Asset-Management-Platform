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
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='%23${color}' width='300' height='300'/%3E%3Ctext x='50%25' y='50%25' font-size='60' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle'%3E${initials}%3C/text%3E%3C/svg%3E`
}

const demoAssets = [
  { name: 'Aurora campaign', type: 'JPG', size: '4.8 MB', color: 'coral', updated: '2 min ago', image: getPlaceholderImage('Aurora campaign') },
  { name: 'Product launch reel', type: 'MP4', size: '182 MB', color: 'blue', updated: '18 min ago', image: getPlaceholderImage('Product launch reel') },
  { name: 'Editorial still life', type: 'PNG', size: '8.2 MB', color: 'green', updated: '1 hr ago', image: getPlaceholderImage('Editorial still life') },
  { name: 'Brand guidelines 2026', type: 'PDF', size: '12.4 MB', color: 'cream', updated: '3 hrs ago', image: getPlaceholderImage('Brand guidelines 2026') },
  { name: 'Studio portraits', type: 'RAW', size: '24.7 MB', color: 'violet', updated: 'Yesterday', image: getPlaceholderImage('Studio portraits') },
  { name: 'Spring social cutdowns', type: 'MOV', size: '94 MB', color: 'yellow', updated: 'Yesterday', image: getPlaceholderImage('Spring social cutdowns') },
]

function App() {
  const [assets, setAssets] = useState(demoAssets)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState([])
  const [starred, setStarred] = useState([])
  const [notice, setNotice] = useState('')
  const [menu, setMenu] = useState(null)
  const [previewAsset, setPreviewAsset] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => {
    fetch('/api/assets/')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setAssets(data))
      .catch(() => setNotice('Demo library loaded. Sign in to sync with the API.'))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewAsset(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visibleAssets = useMemo(() => {
    const filtered = assets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || asset.type === filter))
    return [...filtered].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : 0)
  }, [assets, filter, query, sort])

  const toggleSelection = (name) => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const toggleStar = (name) => setStarred((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const showNotice = (message) => { setNotice(message); setMenu(null) }
  const deleteAsset = (name) => {
    setAssets((current) => current.filter((asset) => asset.name !== name))
    setSelected((current) => current.filter((item) => item !== name))
    setStarred((current) => current.filter((item) => item !== name))
    showNotice(`${name} deleted.`)
  }

  const handleFiles = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    
    const added = files.map((file, index) => {
      const fileType = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
      const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(fileType)
      let image = getPlaceholderImage(file.name)
      
      if (isImage) {
        image = URL.createObjectURL(file)
      }
      
      return {
        name: file.name,
        type: fileType,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        color: ['coral', 'blue', 'green', 'yellow'][index % 4],
        updated: 'Just now',
        image: image
      }
    })
    
    setAssets((current) => [...added, ...current])
    showNotice(`${files.length} asset${files.length > 1 ? 's' : ''} added to this demo library.`)
    event.target.value = ''
  }

  return (
    <div className="shell" onClick={() => menu && setMenu(null)}>
      <aside className="sidebar">
        <div className="wordmark">Digital Asset</div>
        <nav>
          <p className="nav-label">Workspace</p>
          <button className="active" onClick={() => showNotice('Showing all assets')}><span>▦</span> All assets <b>{assets.length}</b></button>
          <button onClick={() => showNotice('Collections view is coming next.')}><span>□</span> Collections</button>
          <button onClick={() => showNotice('No shared assets yet.')}><span>↗</span> Shared with me</button>
          <button onClick={() => showNotice('Trash is empty.')}><span>⌫</span> Trash</button>
          <p className="nav-label second">Manage</p>
          <button onClick={() => showNotice('Activity view is coming next.')}><span>◷</span> Activity</button>
          <button onClick={() => showNotice('Settings view is coming next.')}><span>⚙</span> Settings</button>
        </nav>
        <button className="profile" onClick={() => showNotice('Admin panel coming soon.')}><div><strong>Admin</strong></div></button>
      </aside>
      <main className="main">
        <header className="topbar"><div className="breadcrumbs"><span>Library</span><b>/</b><strong>All assets</strong></div><div className="top-actions"><button className="icon-button" onClick={() => showNotice('You are all caught up.')} aria-label="Notifications">o</button><input ref={fileInput} type="file" multiple hidden onChange={handleFiles} /><button className="upload" onClick={() => fileInput.current?.click()}>+ Upload assets</button></div></header>
        <section className="content" id="assets">
          <div className="title-row"><div><p className="eyebrow">DIGITAL STUDIO / LIBRARY</p><h1>All assets <span>{assets.length}</span></h1><p className="intro">Organize, collaborate, and elevate your creative workflow.</p></div><button className="ghost" onClick={() => setSelected(selected.length ? [] : visibleAssets.map((asset) => asset.name))}>{selected.length ? `Clear (${selected.length})` : 'Select all'}</button></div>
          <div className="toolbar"><label className="search"><span>/</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" /></label><select className="filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Filter: all types</option><option value="JPG">Images</option><option value="MP4">Video</option><option value="PDF">Documents</option></select><select className="sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently added</option><option value="name">Name A-Z</option></select><button className={`view-toggle ${view === 'grid' ? '' : 'muted'}`} onClick={() => setView('grid')} aria-label="Grid view">▦</button><button className={`view-toggle ${view === 'list' ? '' : 'muted'}`} onClick={() => setView('list')} aria-label="List view">☷</button></div>
          <div className="summary"><span><b>{visibleAssets.length}</b> assets shown</span><span className="dot-separator" /><span>{selected.length ? `${selected.length} selected` : 'Updated today'}</span><span className="summary-spacer" /><span className="sync">● Synced just now</span></div>
          {visibleAssets.length ? <div className={`asset-grid ${view === 'list' ? 'list-view' : ''}`}>{visibleAssets.map((asset) => <article className={`asset-card ${selected.includes(asset.name) ? 'selected' : ''}`} key={`${asset.name}-${asset.updated}`} onClick={() => toggleSelection(asset.name)}><div className={`asset-preview ${asset.color}`} onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset) }} style={{cursor: 'pointer'}}>{asset.image && <img src={asset.image} alt={asset.name} loading="lazy" style={{width: '100%', height: '100%', objectFit: 'cover'}} />}<span className="asset-type">{asset.type}</span><button className="card-menu" onClick={(event) => { event.stopPropagation(); setMenu(menu === asset.name ? null : asset.name) }} aria-label={`More options for ${asset.name}`}>...</button>{menu === asset.name && <div className="menu"><button onClick={() => showNotice(`${asset.name} opened.`)}>Open preview</button><button onClick={() => showNotice(`${asset.name} download queued.`)}>Download</button><button onClick={() => deleteAsset(asset.name)}>Delete</button></div>}<div className="preview-shape" /></div><div className="asset-info"><div><h2>{asset.name}</h2><p>{asset.size} <span>·</span> {asset.updated}</p></div><button className={`star ${starred.includes(asset.name) ? 'starred' : ''}`} onClick={(event) => { event.stopPropagation(); toggleStar(asset.name) }} aria-label={`Star ${asset.name}`}>{starred.includes(asset.name) ? '★' : '☆'}</button></div></article>)}</div> : <div className="empty"><strong>No assets found</strong><span>Try another search or upload a new file.</span></div>}
        </section>
      </main>
      {notice && <div className="toast">{notice}</div>}
      {previewAsset && <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}} onClick={() => setPreviewAsset(null)}><div style={{position: 'relative', backgroundColor: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '70vw', maxHeight: '70vh', overflowY: 'auto', overflowX: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'}} onClick={(e) => e.stopPropagation()}><button onClick={() => setPreviewAsset(null)} style={{position: 'absolute', top: '10px', right: '10px', backgroundColor: '#f0f0f0', border: 'none', color: '#333', fontSize: '24px', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%'}}>×</button><img src={previewAsset.image} alt={previewAsset.name} style={{maxWidth: '100%', maxHeight: 'calc(70vh - 80px)', objectFit: 'contain', display: 'block', marginBottom: '10px'}} /><div style={{paddingRight: '36px'}}><h3 style={{margin: '0 0 5px 0', color: '#333'}}>{previewAsset.name}</h3><p style={{margin: '0', color: '#666', fontSize: '14px'}}>{previewAsset.size} · {previewAsset.type}</p></div></div></div>}
    </div>
  )
}

export default App
