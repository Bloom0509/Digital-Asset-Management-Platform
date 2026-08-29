import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const demoAssets = [
  { name: 'Aurora campaign', type: 'JPG', size: '4.8 MB', color: 'coral', updated: '2 min ago', image: 'https://picsum.photos/300/300?random=1' },
  { name: 'Product launch reel', type: 'MP4', size: '182 MB', color: 'blue', updated: '18 min ago', image: 'https://picsum.photos/300/300?random=2' },
  { name: 'Editorial still life', type: 'PNG', size: '8.2 MB', color: 'green', updated: '1 hr ago', image: 'https://picsum.photos/300/300?random=3' },
  { name: 'Brand guidelines 2026', type: 'PDF', size: '12.4 MB', color: 'cream', updated: '3 hrs ago', image: 'https://picsum.photos/300/300?random=4' },
  { name: 'Studio portraits', type: 'RAW', size: '24.7 MB', color: 'violet', updated: 'Yesterday', image: 'https://picsum.photos/300/300?random=5' },
  { name: 'Spring social cutdowns', type: 'MOV', size: '94 MB', color: 'yellow', updated: 'Yesterday', image: 'https://picsum.photos/300/300?random=6' },
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
    const added = files.map((file, index) => ({ name: file.name, type: file.name.split('.').pop()?.toUpperCase() ?? 'FILE', size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, color: ['coral', 'blue', 'green', 'yellow'][index % 4], updated: 'Just now', image: `https://picsum.photos/300/300?random=${Math.random()}` }))
    setAssets((current) => [...added, ...current])
    showNotice(`${files.length} asset${files.length > 1 ? 's' : ''} added to this demo library.`)
    event.target.value = ''
  }

  return (
    <div className="shell" onClick={() => menu && setMenu(null)}>
      <aside className="sidebar">
        <div className="wordmark"><span className="mark">O</span> orbit</div>
        <button className="workspace" onClick={() => showNotice('Workspace switching is coming next.')}><span className="workspace-dot" /> Northstar Studio <span className="chevron">v</span></button>
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
        <div className="storage"><div className="storage-head"><span>Storage</span><span>68%</span></div><div className="progress"><i /></div><small>68.4 GB of 100 GB used</small></div>
        <button className="profile" onClick={() => showNotice('Profile settings are coming next.')}><div className="avatar">AK</div><div><strong>Alex Kim</strong><small>Administrator</small></div><span className="dots">...</span></button>
      </aside>
      <main className="main">
        <header className="topbar"><div className="breadcrumbs"><span>Library</span><b>/</b><strong>All assets</strong></div><div className="top-actions"><button className="icon-button" onClick={() => showNotice('You are all caught up.')} aria-label="Notifications">o</button><input ref={fileInput} type="file" multiple hidden onChange={handleFiles} /><button className="upload" onClick={() => fileInput.current?.click()}>+ Upload assets</button></div></header>
        <section className="content" id="assets">
          <div className="title-row"><div><p className="eyebrow">NORTHSTAR STUDIO / LIBRARY</p><h1>All assets <span>{assets.length}</span></h1><p className="intro">A shared home for your team&apos;s best work.</p></div><button className="ghost" onClick={() => setSelected(selected.length ? [] : visibleAssets.map((asset) => asset.name))}>{selected.length ? `Clear (${selected.length})` : 'Select all'}</button></div>
          <div className="toolbar"><label className="search"><span>/</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" /></label><select className="filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Filter: all types</option><option value="JPG">Images</option><option value="MP4">Video</option><option value="PDF">Documents</option></select><select className="sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently added</option><option value="name">Name A-Z</option></select><button className={`view-toggle ${view === 'grid' ? '' : 'muted'}`} onClick={() => setView('grid')} aria-label="Grid view">▦</button><button className={`view-toggle ${view === 'list' ? '' : 'muted'}`} onClick={() => setView('list')} aria-label="List view">☷</button></div>
          <div className="summary"><span><b>{visibleAssets.length}</b> assets shown</span><span className="dot-separator" /><span>{selected.length ? `${selected.length} selected` : 'Updated today'}</span><span className="summary-spacer" /><span className="sync">● Synced just now</span></div>
          {visibleAssets.length ? <div className={`asset-grid ${view === 'list' ? 'list-view' : ''}`}>{visibleAssets.map((asset) => <article className={`asset-card ${selected.includes(asset.name) ? 'selected' : ''}`} key={`${asset.name}-${asset.updated}`} onClick={() => toggleSelection(asset.name)}><div className={`asset-preview ${asset.color}`}>{asset.image && <img src={asset.image} alt={asset.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}<span className="asset-type">{asset.type}</span><button className="card-menu" onClick={(event) => { event.stopPropagation(); setMenu(menu === asset.name ? null : asset.name) }} aria-label={`More options for ${asset.name}`}>...</button>{menu === asset.name && <div className="menu"><button onClick={() => showNotice(`${asset.name} opened.`)}>Open preview</button><button onClick={() => showNotice(`${asset.name} download queued.`)}>Download</button><button onClick={() => deleteAsset(asset.name)}>Delete</button></div>}<div className="preview-shape" /></div><div className="asset-info"><div><h2>{asset.name}</h2><p>{asset.size} <span>·</span> {asset.updated}</p></div><button className={`star ${starred.includes(asset.name) ? 'starred' : ''}`} onClick={(event) => { event.stopPropagation(); toggleStar(asset.name) }} aria-label={`Star ${asset.name}`}>{starred.includes(asset.name) ? '★' : '☆'}</button></div></article>)}</div> : <div className="empty"><strong>No assets found</strong><span>Try another search or upload a new file.</span></div>}
        </section>
      </main>
      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

export default App
