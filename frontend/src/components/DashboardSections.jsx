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
  onRename,
  onEditMetadata,
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
          isMenuOpen={menu === asset.name}
          onToggleSelect={onToggleSelect}
          onToggleMenu={onToggleMenu}
          onOpenPreview={onOpenPreview}
          onDownload={onDownload}
          onRename={onRename}
          onEditMetadata={onEditMetadata}
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

export function AssetMetadataModal({ form, isSaving, onChange, onClose, onSubmit, title = 'Edit metadata', description = 'Improve discovery and give your team the context they need.', submitLabel = 'Save metadata' }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="asset-modal metadata-modal" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close metadata editor">×</button>
        <div className="asset-modal-copy">
          <p className="eyebrow">ASSET DETAILS</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <AssetMetadataFields form={form} onChange={onChange} />
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="upload create-submit" disabled={isSaving}>{isSaving ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </div>
  )
}
