import { useEffect, useState } from 'react'
import ActivityItem from './ActivityItem.jsx'
import AssetCard from './AssetCard.jsx'
import CollectionCard from './CollectionCard.jsx'
import UploadQueueItem from './UploadQueueItem.jsx'
import { getAssetSelectionKey } from './assetSelection.js'

export function UploadQueue({ items, onClearFinished }) {
  if (!items.length) return null

  return (
    <div className="upload-queue" aria-live="polite">
      <div className="upload-queue-heading">
        <strong>Uploads</strong>
        <button type="button" onClick={onClearFinished}>Clear finished</button>
      </div>
      {items.slice(0, 5).map((item) => <UploadQueueItem item={item} key={item.id} />)}
      {items.length > 5 && <small className="upload-queue-more">and {items.length - 5} more…</small>}
    </div>
  )
}

const formatStorageSize = (sizeBytes) => {
  const bytes = Number(sizeBytes || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StorageReport({ data, period, isLoading, error, onPeriodChange, onRetry }) {
  const maximumTypeBytes = Math.max(1, ...(data?.by_type || []).map((item) => item.total_bytes))
  const maximumPeriodBytes = Math.max(1, ...(data?.timeline || []).map((item) => item.total_bytes))
  const periods = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '365d', label: '12 months' },
  ]

  return (
    <section className="storage-report" aria-labelledby="storage-report-title" aria-busy={isLoading}>
      <header className="storage-report-heading">
        <div>
          <h2 id="storage-report-title">Storage report</h2>
          <span>{data?.workspace?.name || 'Current workspace'} · includes files in Trash</span>
        </div>
        <label>
          <span>Upload period</span>
          <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
            {periods.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
      </header>

      {error ? (
        <div className="storage-report-error" role="alert">
          <span>{error}</span>
          <button type="button" className="filter-reset" onClick={onRetry}>Retry</button>
        </div>
      ) : !data && isLoading ? (
        <p className="storage-report-status" role="status">Loading workspace storage…</p>
      ) : data ? (
        <>
          <div className="storage-report-stats">
            <div><span>Total stored</span><strong>{formatStorageSize(data.total_bytes)}</strong></div>
            <div><span>Files stored</span><strong>{data.asset_count.toLocaleString()}</strong></div>
            <div><span>Uploaded in period</span><strong>{formatStorageSize(data.period_bytes)}</strong><small>{data.period_asset_count.toLocaleString()} files</small></div>
          </div>

          <div className="storage-report-breakdowns">
            <section aria-labelledby="storage-types-title">
              <h3 id="storage-types-title">By file type</h3>
              {data.by_type.length ? <ul className="storage-type-list">
                {data.by_type.map((item) => (
                  <li key={item.content_type}>
                    <div className="storage-type-label"><strong>{item.type}</strong><span>{formatStorageSize(item.total_bytes)} · {item.asset_count} files</span></div>
                    <div className="storage-type-track"><span style={{ width: `${(item.total_bytes / maximumTypeBytes) * 100}%` }} /></div>
                  </li>
                ))}
              </ul> : <p className="storage-report-status">No stored files in this workspace.</p>}
            </section>

            <section aria-labelledby="storage-period-title">
              <h3 id="storage-period-title">Uploads over time</h3>
              {data.timeline.length ? <>
                <div className="storage-timeline" role="img" aria-label={`Storage added per time bucket over the last ${periods.find((option) => option.value === period)?.label}`}>
                  {data.timeline.map((item) => (
                    <div className="storage-timeline-column" key={item.date} title={`${item.date}: ${formatStorageSize(item.total_bytes)}, ${item.asset_count} files`}>
                      <span style={{ height: `${Math.max(4, (item.total_bytes / maximumPeriodBytes) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="storage-timeline-labels"><span>{data.timeline[0].date}</span><span>{data.timeline[data.timeline.length - 1].date}</span></div>
              </> : <p className="storage-report-status">No uploads during this period.</p>}
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}

export function RequestChangesModal({ asset, note, isSaving, onNoteChange, onClose, onSubmit }) {
  if (!asset) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="asset-modal request-changes-modal" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Close review dialog">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">ASSET REVIEW</p>
          <h3>Request changes</h3>
          <p>Tell {asset.name}’s editor what needs to change.</p>
        </div>
        <label className="request-changes-note">
          <span>Review note</span>
          <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} maxLength={2000} rows={5} required autoFocus />
          <small>{note.length}/2000</small>
        </label>
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="upload create-submit" disabled={isSaving || !note.trim()}>{isSaving ? 'Sending…' : 'Request changes'}</button>
        </div>
      </form>
    </div>
  )
}

export function AssetAuditModal({ asset, events, isLoading, error, onClose }) {
  if (!asset) return null
  const actionLabels = {
    uploaded: 'Uploaded',
    replaced: 'Replaced file',
    restored: 'Restored',
    downloaded: 'Downloaded',
    shared: 'Shared',
  }

  const describeEvent = (event) => {
    const details = event.details || {}
    if (event.action === 'uploaded' || event.action === 'replaced') {
      return [details.filename, details.content_type, details.size_bytes ? formatStorageSize(details.size_bytes) : '']
        .filter(Boolean)
        .join(' · ')
    }
    if (event.action === 'restored') {
      return details.source === 'version' ? `Version ${details.version_number}` : 'From Trash'
    }
    if (event.action === 'downloaded' && details.rendition) {
      return `${details.format?.toUpperCase()} · ${details.width}×${details.height} · quality ${details.quality}`
    }
    return event.action === 'shared' ? 'Workspace link' : ''
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="asset-modal asset-audit-modal" onClick={(event) => event.stopPropagation()} aria-labelledby="asset-audit-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close audit history">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">ASSET HISTORY</p>
          <h3 id="asset-audit-title">Audit trail</h3>
          <p>{asset.name}</p>
        </div>
        {error ? <p className="asset-audit-state" role="alert">{error}</p> : isLoading ? (
          <p className="asset-audit-state" role="status">Loading history…</p>
        ) : events.length ? (
          <ol className="asset-audit-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className={`asset-audit-marker audit-${event.action}`} aria-hidden="true" />
                <div className="asset-audit-entry">
                  <div className="asset-audit-entry-heading">
                    <strong>{actionLabels[event.action] || event.action}</strong>
                    <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                  </div>
                  <span>{event.actor_name}</span>
                  {describeEvent(event) && <small>{describeEvent(event)}</small>}
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="asset-audit-state">No audit events recorded yet.</p>}
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  )
}

export function RenditionModal({ asset, apiRequest, onClose, onNotice }) {
  const [outputFormat, setOutputFormat] = useState('jpg')
  const [width, setWidth] = useState('1920')
  const [height, setHeight] = useState('1920')
  const [quality, setQuality] = useState(82)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!asset) return null

  const getRenditionUrl = (download = false) => {
    const params = new URLSearchParams({
      rendition: '1',
      output_format: outputFormat,
      width,
      height,
      quality: String(quality),
    })
    if (download) params.set('download', '1')
    return `/api/assets/${asset.id}/file/?${params.toString()}`
  }

  const fetchRendition = async (download = false) => {
    const response = await apiRequest(getRenditionUrl(download))
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.detail || Object.values(data || {}).flat()?.[0] || 'Unable to generate this rendition.')
    }
    return response.blob()
  }

  const generatePreview = async () => {
    setIsLoading(true)
    setError('')
    try {
      const blobUrl = URL.createObjectURL(await fetchRendition())
      setPreviewUrl(blobUrl)
    } catch (requestError) {
      setError(requestError.message || 'Unable to generate this rendition.')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadRendition = async () => {
    setIsLoading(true)
    setError('')
    try {
      const blobUrl = URL.createObjectURL(await fetchRendition(true))
      const downloadLink = document.createElement('a')
      const name = asset.name.replace(/\.[^.]+$/, '') || 'asset'
      downloadLink.href = blobUrl
      downloadLink.download = `${name}-${width}x${height}.${outputFormat}`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
      onNotice(`${downloadLink.download} download started.`)
    } catch (requestError) {
      setError(requestError.message || 'Unable to download this rendition.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="asset-modal rendition-modal" onClick={(event) => event.stopPropagation()} aria-labelledby="rendition-title">
        <button className="modal-close" type="button" onClick={onClose} disabled={isLoading} aria-label="Close rendition editor">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">IMAGE EXPORT</p>
          <h3 id="rendition-title">Resize or convert</h3>
          <p>{asset.name} · Original stays unchanged</p>
        </div>

        <div className="rendition-controls">
          <label>
            <span>Format</span>
            <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)} disabled={isLoading}>
              <option value="jpg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label>
            <span>Max width (px)</span>
            <input type="number" min="1" max="4096" step="1" value={width} onChange={(event) => setWidth(event.target.value)} disabled={isLoading} />
          </label>
          <label>
            <span>Max height (px)</span>
            <input type="number" min="1" max="4096" step="1" value={height} onChange={(event) => setHeight(event.target.value)} disabled={isLoading} />
          </label>
          <label className="rendition-quality">
            <span>Quality <strong>{quality}</strong></span>
            <input type="range" min="30" max="95" value={quality} onChange={(event) => setQuality(Number(event.target.value))} disabled={isLoading || outputFormat === 'png'} />
            <small>{outputFormat === 'png' ? 'PNG uses lossless compression.' : 'Higher quality creates a larger file.'}</small>
          </label>
        </div>

        {error && <p className="rendition-error" role="alert">{error}</p>}
        <div className="rendition-preview">
          {previewUrl ? <img src={previewUrl} alt={`${asset.name} rendition preview`} /> : <span>Generate a preview to inspect the resized output.</span>}
        </div>
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button type="button" className="ghost create-cancel" onClick={generatePreview} disabled={isLoading}>{isLoading ? 'Processing…' : 'Preview'}</button>
          <button type="button" className="upload create-submit" onClick={downloadRendition} disabled={isLoading}>{isLoading ? 'Processing…' : 'Download rendition'}</button>
        </div>
      </section>
    </div>
  )
}

export function ActivityFeed({ activities }) {
  if (!activities.length) {
    return <div className="empty activity-empty"><strong>No activity yet</strong><span>Actions in your workspace will appear here in real time.</span></div>
  }

  return (
    <div className="activity-feed">
      {activities.map((activity) => <ActivityItem activity={activity} key={activity.id} />)}
    </div>
  )
}

export function CollectionGrid({ collections, getCollectionThumbnails, onSelectCollection }) {
  if (!collections.length) {
    return <div className="empty"><strong>No collections yet</strong><span>Create a collection to start organizing media.</span></div>
  }

  return (
    <div className="collection-grid">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} getCollectionThumbnails={getCollectionThumbnails} onSelect={onSelectCollection} />
      ))}
    </div>
  )
}

export function AssetGrid({
  assets,
  view,
  selected,
  starred,
  activeSection,
  canManageWorkspace,
  isAdmin,
  menu,
  onToggleSelect,
  onToggleMenu,
  onOpenPreview,
  onDownload,
  onOpenRendition,
  onOpenAudit,
  onShare,
  onRename,
  onEditMetadata,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  onRestore,
  onPermanentlyDelete,
  onRemoveFromCollection,
  onAddToCollection,
  onDelete,
  onToggleStar,
}) {
  if (!assets.length) {
    return (
      <div className="empty">
        <strong>{activeSection === 'trash' ? 'Trash is empty' : 'No assets yet'}</strong>
        <span>{activeSection === 'trash' ? 'Deleted assets will appear here.' : 'Upload a new file to start your library.'}</span>
      </div>
    )
  }

  return (
    <div className={`asset-grid ${view === 'list' ? 'list-view' : ''}`}>
      {assets.map((asset) => (
        <AssetCard
          key={asset.id ?? `${asset.name}-${asset.updated}`}
          asset={asset}
          isSelected={selected.includes(getAssetSelectionKey(asset))}
          isStarred={starred.includes(asset.name)}
          activeSection={activeSection}
          canManageWorkspace={canManageWorkspace}
          isAdmin={isAdmin}
          isMenuOpen={menu === getAssetSelectionKey(asset)}
          onToggleSelect={onToggleSelect}
          onToggleMenu={onToggleMenu}
          onOpenPreview={onOpenPreview}
          onDownload={onDownload}
          onOpenRendition={onOpenRendition}
          onOpenAudit={onOpenAudit}
          onShare={onShare}
          onRename={onRename}
          onEditMetadata={onEditMetadata}
          onSubmitForReview={onSubmitForReview}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
          onRestore={onRestore}
          onPermanentlyDelete={onPermanentlyDelete}
          onRemoveFromCollection={onRemoveFromCollection}
          onAddToCollection={onAddToCollection}
          onDelete={onDelete}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  )
}

export function BulkImportModal({ files, manifest, isImporting, onFilesChange, onManifestChange, onImport, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="asset-modal bulk-import-modal" onClick={(event) => event.stopPropagation()} aria-labelledby="bulk-import-title">
        <button className="modal-close" type="button" onClick={onClose} disabled={isImporting} aria-label="Close bulk import">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">LIBRARY TRANSFER</p>
          <h3 id="bulk-import-title">Import assets</h3>
          <p>Import a folder with an optional metadata manifest, or import an exported CSV to update existing asset metadata.</p>
        </div>
        <label className="bulk-import-picker">
          <span>Asset folder</span>
          <input
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            onChange={(event) => onFilesChange(Array.from(event.target.files || []))}
            disabled={isImporting}
          />
          <small>{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Select a folder to import its files.'}</small>
        </label>
        <label className="bulk-import-picker">
          <span>Metadata manifest (CSV, optional)</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => onManifestChange(event.target.files?.[0] || null)}
            disabled={isImporting}
          />
          <small>{manifest ? manifest.name : 'Folder manifests use filename and metadata columns. Metadata-only imports use the exported id column.'}</small>
        </label>
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isImporting}>Cancel</button>
          <button type="button" className="upload create-submit" onClick={onImport} disabled={isImporting || (!files.length && !manifest)}>
            {isImporting ? 'Importing…' : files.length ? `Import ${files.length} assets` : 'Update from CSV'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function ToastNotification({ message, onDismiss }) {
  if (!message) return null

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button className="toast-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss notification" title="Dismiss notification">Dismiss ×</button>
    </div>
  )
}

export function AssetPreviewModal({ asset, onClose }) {
  if (!asset) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="asset-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose}>×</button>
        {asset.previewLoading ? (
          <div className="asset-preview-loading" role="status">Loading original file…</div>
        ) : asset.kind === 'video' ? (
          <video src={asset.image} controls playsInline className="asset-modal-image" />
        ) : (
          <img src={asset.image} alt={asset.name} className="asset-modal-image" />
        )}
        <div className="asset-modal-copy">
          <h3>{asset.name}</h3>
          <p>{asset.size} · {asset.type}</p>
          {asset.description && <p className="asset-description">{asset.description}</p>}
          {asset.alt_text && <p className="asset-metadata-line"><strong>Alt text:</strong> {asset.alt_text}</p>}
          {!!asset.tags?.length && <div className="asset-tags preview-tags">{asset.tags.map((tag) => <span className="asset-tag" key={tag}>{tag}</span>)}</div>}
          {(asset.creator || asset.campaign || asset.license) && (
            <dl className="asset-metadata-list">
              {asset.creator && <div><dt>Creator</dt><dd>{asset.creator}</dd></div>}
              {asset.campaign && <div><dt>Campaign</dt><dd>{asset.campaign}</dd></div>}
              {asset.license && <div><dt>License</dt><dd>{asset.license}</dd></div>}
            </dl>
          )}
          {!!Object.keys(asset.custom_fields || {}).length && (
            <dl className="asset-metadata-list custom-metadata-list">
              {Object.entries(asset.custom_fields).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

export function AssetMetadataFields({ form, onChange, className = '' }) {
  const updateField = (event) => onChange((current) => ({ ...current, [event.target.name]: event.target.value }))

  return (
    <div className={`metadata-form-grid ${className}`}>
      <label className="metadata-full-width">
        <span>Tags</span>
        <input name="tags" value={form.tags} onChange={updateField} placeholder="brand, campaign, approved" />
        <small>Separate tags with commas (up to 20).</small>
      </label>
      <label className="metadata-full-width">
        <span>Description</span>
        <textarea name="description" value={form.description} onChange={updateField} maxLength={5000} rows={3} placeholder="What is this asset for?" />
      </label>
      <label className="metadata-full-width">
        <span>Alt text</span>
        <input name="alt_text" value={form.alt_text} onChange={updateField} maxLength={500} placeholder="Accessible description of the visual" />
      </label>
      <label>
        <span>Creator / credit</span>
        <input name="creator" value={form.creator} onChange={updateField} maxLength={150} placeholder="Photographer or team" />
      </label>
      <label>
        <span>Campaign</span>
        <input name="campaign" value={form.campaign} onChange={updateField} maxLength={150} placeholder="Spring launch" />
      </label>
      <label className="metadata-full-width">
        <span>License / usage rights</span>
        <input name="license" value={form.license} onChange={updateField} maxLength={150} placeholder="Internal use, CC BY 4.0, etc." />
      </label>
      <label className="metadata-full-width">
        <span>Custom fields</span>
        <textarea name="custom_fields" value={form.custom_fields} onChange={updateField} rows={3} placeholder={'Brand: Acme\nRegion: North America'} />
        <small>One “name: value” field per line (up to 20).</small>
      </label>
    </div>
  )
}

export function AssetMetadataModal({
  form,
  isSaving,
  onChange,
  onClose,
  onSubmit,
  onPreview,
  canvasEditor,
  onSaveAs,
  versions = [],
  selectedVersionId = '',
  onSelectVersion,
  onRestoreVersion,
  isLoadingVersions = false,
  replacementFile = null,
  onReplacementFileChange,
  apiRequest,
  asset = null,
  title = 'Edit metadata',
  description = 'Improve discovery and give your team the context they need.',
  submitLabel = 'Save',
  saveAsLabel = 'Save as new',
}) {
  const isVideo = asset?.kind === 'video' || asset?.content_type?.startsWith('video/')
  const selectedVersion = versions.find((version) => version.id === selectedVersionId)
  const [comparisonFiles, setComparisonFiles] = useState({})

  useEffect(() => {
    let isStale = false
    const objectUrls = []
    const loadFile = async (key, fileUrl) => {
      if (!fileUrl || !apiRequest) return
      try {
        const response = await apiRequest(fileUrl)
        if (!response.ok) return
        const objectUrl = URL.createObjectURL(await response.blob())
        objectUrls.push(objectUrl)
        if (!isStale) setComparisonFiles((current) => ({ ...current, [key]: objectUrl }))
      } catch {}
    }

    setComparisonFiles({})
    loadFile('current', asset?.file_url)
    loadFile('version', selectedVersion?.file_url)
    return () => {
      isStale = true
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [apiRequest, asset?.file_url, selectedVersion?.file_url])

  const formatSize = (sizeBytes) => `${(Number(sizeBytes || 0) / 1024 / 1024).toFixed(1)} MB`
  const comparisonFields = [
    ['Tags', (value) => (value.tags || []).join(', ') || 'None'],
    ['Description', (value) => value.description || 'None'],
    ['Creator', (value) => value.creator || 'None'],
    ['Campaign', (value) => value.campaign || 'None'],
    ['License', (value) => value.license || 'None'],
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="asset-modal metadata-modal" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close metadata editor">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">ASSET DETAILS</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        {canvasEditor}

        {asset && (
          <div className="asset-edit-preview">
            <div className="asset-edit-preview-frame">
              {isVideo ? (
                <video src={comparisonFiles.current || asset.image || asset.file_url} controls playsInline className="asset-modal-image asset-edit-video" />
              ) : (
                <img src={comparisonFiles.current || asset.image || asset.file_url} alt={asset.name} className="asset-modal-image asset-edit-image" />
              )}
            </div>
            <div className="asset-edit-meta">
              <strong>{asset.name}</strong>
              <span>{asset.size || 'Unknown size'} · {asset.type || 'FILE'}</span>
            </div>
          </div>
        )}

        {asset && (
          <section className="asset-version-history" aria-labelledby="asset-version-heading">
            <div className="asset-version-heading">
              <div>
                <h4 id="asset-version-heading">Version history</h4>
                <span>{isLoadingVersions ? 'Loading versions…' : `${versions.length} previous version${versions.length === 1 ? '' : 's'}`}</span>
              </div>
              <label>
                <span className="sr-only">Choose a version to compare</span>
                <select value={selectedVersionId} onChange={(event) => onSelectVersion?.(event.target.value)} disabled={!versions.length || isLoadingVersions}>
                  {versions.length ? versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      Version {version.version_number} · {new Date(version.created_at).toLocaleString()}
                    </option>
                  )) : <option value="">No saved versions</option>}
                </select>
              </label>
            </div>
            {selectedVersion && (
              <>
                <div className="asset-version-previews">
                  {[{ label: 'Current', data: asset, preview: comparisonFiles.current }, { label: `Version ${selectedVersion.version_number}`, data: selectedVersion, preview: comparisonFiles.version }].map(({ label, data, preview }) => (
                    <div className="asset-version-preview" key={label}>
                      <strong>{label}</strong>
                      {preview && data.content_type?.startsWith('image/') ? (
                        <img src={preview} alt={`${label} preview`} />
                      ) : preview && data.content_type?.startsWith('video/') ? (
                        <video src={preview} controls playsInline />
                      ) : (
                        <div className="asset-version-file-label">{data.content_type || 'File'}</div>
                      )}
                      <span>{data.name} · {formatSize(data.size_bytes)}</span>
                    </div>
                  ))}
                </div>
                <dl className="asset-version-diff">
                  {comparisonFields.map(([label, formatValue]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd><span>{formatValue(asset)}</span><span>{formatValue(selectedVersion)}</span></dd>
                    </div>
                  ))}
                </dl>
                <button type="button" className="ghost asset-version-restore" onClick={() => onRestoreVersion?.(selectedVersion)} disabled={isSaving || !onRestoreVersion}>
                  Restore version {selectedVersion.version_number}
                </button>
              </>
            )}
          </section>
        )}

        {asset && (
          <label className="asset-replacement-picker">
            <span>Replace active file</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.avif,.mp4,.webm,.mov,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={(event) => onReplacementFileChange?.(event.target.files?.[0] || null)}
              disabled={isSaving}
            />
            <small>{replacementFile ? `${replacementFile.name} selected` : 'The existing file will be saved as a restorable version.'}</small>
          </label>
        )}

        <AssetMetadataFields form={form} onChange={onChange} />
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          {onPreview && <button type="button" className="ghost create-cancel" onClick={onPreview} disabled={isSaving}>Preview</button>}
          <button type="submit" className="upload create-submit" disabled={isSaving}>{isSaving ? 'Saving…' : submitLabel}</button>
          {onSaveAs && <button type="button" className="upload secondary create-submit" disabled={isSaving || Boolean(replacementFile)} onClick={onSaveAs} title={replacementFile ? 'Clear the replacement file to save a separate copy.' : undefined}>{isSaving ? 'Saving…' : saveAsLabel}</button>}
        </div>
      </form>
    </div>
  )
}

export function BulkAssetMetadataModal({ form, enabledFields, assets, tagsByAsset, isSaving, onFieldToggle, onTagChange, onChange, onClose, onSubmit }) {
  const updateField = (event) => onChange((current) => ({ ...current, [event.target.name]: event.target.value }))
  const fields = [
    { name: 'description', label: 'Description' },
    { name: 'alt_text', label: 'Alt text' },
    { name: 'creator', label: 'Creator / credit' },
    { name: 'campaign', label: 'Campaign' },
    { name: 'license', label: 'License / usage rights' },
    { name: 'custom_fields', label: 'Custom fields', hint: 'One “name: value” field per line.' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="asset-modal metadata-modal bulk-metadata-modal" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close bulk metadata editor">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">BULK EDIT</p>
          <h3>Edit metadata for {assets.length} assets</h3>
          <p>Tags can be changed separately for each asset. Other checked fields will be applied to all selected assets.</p>
        </div>
        <div className="bulk-metadata-fields">
          <div className="bulk-metadata-field">
            <label className="bulk-metadata-toggle">
              <input type="checkbox" checked={enabledFields.includes('tags')} onChange={() => onFieldToggle('tags')} />
              <span>Update tags individually</span>
            </label>
            {enabledFields.includes('tags') && (
              <div className="bulk-tag-asset-list">
                {assets.map((asset) => (
                  <label className="bulk-tag-asset-row" key={asset.id}>
                    <span className="bulk-tag-asset-name" title={asset.name}>{asset.name}</span>
                    <small>Current: {(asset.tags || []).join(', ') || 'No tags'}</small>
                    <input
                      value={tagsByAsset[asset.id] ?? ''}
                      onChange={(event) => onTagChange(asset.id, event.target.value)}
                      placeholder="Enter new tags, separated by commas"
                      aria-label={`New tags for ${asset.name}`}
                    />
                  </label>
                ))}
                <small>Enter up to 20 tags per asset. Leave the input empty to remove all tags for that asset.</small>
              </div>
            )}
          </div>
          {fields.map(({ name, label, hint }) => (
            <div className="bulk-metadata-field" key={name}>
              <label className="bulk-metadata-toggle">
                <input type="checkbox" checked={enabledFields.includes(name)} onChange={() => onFieldToggle(name)} />
                <span>{label}</span>
              </label>
              {enabledFields.includes(name) && (
                name === 'description' ? (
                  <textarea name={name} value={form[name]} onChange={updateField} maxLength={5000} rows={2} placeholder="Description for selected assets" />
                ) : name === 'custom_fields' ? (
                  <textarea name={name} value={form[name]} onChange={updateField} rows={2} placeholder={'Brand: Acme\nRegion: North America'} />
                ) : (
                  <input name={name} value={form[name]} onChange={updateField} maxLength={name === 'tags' ? undefined : name === 'alt_text' ? 500 : 150} placeholder={name === 'tags' ? 'brand, campaign, approved' : `Set ${label.toLowerCase()}`} />
                )
              )}
              {enabledFields.includes(name) && hint && <small>{hint}</small>}
            </div>
          ))}
        </div>
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="upload create-submit" disabled={isSaving || !enabledFields.length}>{isSaving ? 'Saving…' : 'Apply to selected'}</button>
        </div>
      </form>
    </div>
  )
}
