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
          isMenuOpen={menu === getAssetSelectionKey(asset)}
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

export function AssetMetadataModal({
  form,
  isSaving,
  onChange,
  onClose,
  onSubmit,
  onPreview,
  canvasEditor,
  onSaveAs,
  asset = null,
  title = 'Edit metadata',
  description = 'Improve discovery and give your team the context they need.',
  submitLabel = 'Save',
  saveAsLabel = 'Save as new',
}) {
  const isVideo = asset?.kind === 'video' || asset?.content_type?.startsWith('video/')

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
                <video src={asset.image || asset.file_url} controls playsInline className="asset-modal-image asset-edit-video" />
              ) : (
                <img src={asset.image || asset.file_url} alt={asset.name} className="asset-modal-image asset-edit-image" />
              )}
            </div>
            <div className="asset-edit-meta">
              <strong>{asset.name}</strong>
              <span>{asset.size || 'Unknown size'} · {asset.type || 'FILE'}</span>
            </div>
          </div>
        )}

        <AssetMetadataFields form={form} onChange={onChange} />
        <div className="create-asset-actions">
          <button type="button" className="ghost create-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          {onPreview && <button type="button" className="ghost create-cancel" onClick={onPreview} disabled={isSaving}>Preview</button>}
          <button type="submit" className="upload create-submit" disabled={isSaving}>{isSaving ? 'Saving…' : submitLabel}</button>
          {onSaveAs && <button type="button" className="upload secondary create-submit" disabled={isSaving} onClick={onSaveAs}>{isSaving ? 'Saving…' : saveAsLabel}</button>}
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
