import ActivityItem from './ActivityItem.jsx'
import AssetCard from './AssetCard.jsx'
import CollectionCard from './CollectionCard.jsx'
import UploadQueueItem from './UploadQueueItem.jsx'

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
  onToggleMenu,
  onOpenPreview,
  onDownload,
  onRename,
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
          isSelected={selected.includes(asset.name)}
          isStarred={starred.includes(asset.name)}
          activeSection={activeSection}
          canManageWorkspace={canManageWorkspace}
          isAdmin={isAdmin}
          isMenuOpen={menu === asset.name}
          onToggleMenu={onToggleMenu}
          onOpenPreview={onOpenPreview}
          onDownload={onDownload}
          onRename={onRename}
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
        </div>
      </div>
    </div>
  )
}
