function AssetCardMenu({ asset, activeSection, canManageWorkspace, isAdmin, onOpenPreview, onDownload, onRename, onEditMetadata, onRestore, onPermanentlyDelete, onRemoveFromCollection, onAddToCollection, onDelete, onClose }) {
  return (
    <div className="menu">
      <button type="button" onClick={(event) => { event.stopPropagation(); onClose(); onOpenPreview(asset) }}>Open preview</button>
      <button type="button" onClick={(event) => { event.stopPropagation(); onDownload(asset) }}>Download</button>
      {canManageWorkspace && activeSection !== 'trash' && <button type="button" onClick={(event) => { event.stopPropagation(); onRename(asset) }}>Rename</button>}
      {canManageWorkspace && activeSection !== 'trash' && <button type="button" onClick={(event) => { event.stopPropagation(); onClose(); onEditMetadata(asset) }}>Edit metadata</button>}
      {activeSection === 'trash' ? (
        canManageWorkspace && <>
          <button type="button" onClick={(event) => { event.stopPropagation(); onRestore(asset) }}>Restore</button>
          {isAdmin && <button type="button" onClick={(event) => { event.stopPropagation(); onPermanentlyDelete(asset) }}>Delete permanently</button>}
        </>
      ) : activeSection === 'collection' ? (
        <>
          {canManageWorkspace && <button type="button" onClick={(event) => { event.stopPropagation(); onRemoveFromCollection(asset) }}>Remove from collection</button>}
          <button
            type="button"
            disabled={!canManageWorkspace}
            title={canManageWorkspace ? 'Move this asset to Trash' : 'Editor or admin access is required to delete assets'}
            onClick={(event) => { event.stopPropagation(); onDelete(asset) }}
          >
            {canManageWorkspace ? 'Delete' : 'Delete (editor/admin only)'}
          </button>
        </>
      ) : (
        <>
          {canManageWorkspace && <button type="button" onClick={(event) => { event.stopPropagation(); onAddToCollection(asset) }}>Add to collection</button>}
          <button
            type="button"
            disabled={!canManageWorkspace}
            title={canManageWorkspace ? 'Move this asset to Trash' : 'Editor or admin access is required to delete assets'}
            onClick={(event) => { event.stopPropagation(); onDelete(asset) }}
          >
            {canManageWorkspace ? 'Delete' : 'Delete (editor/admin only)'}
          </button>
        </>
      )}
    </div>
  )
}

export default function AssetCard({
  asset,
  isSelected,
  isStarred,
  activeSection,
  canManageWorkspace,
  isAdmin,
  isMenuOpen,
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
  const stopAnd = (event, callback) => {
    event.stopPropagation()
    callback(asset)
  }

  return (
    <article
      className={`asset-card ${isSelected ? 'selected' : ''} ${isMenuOpen ? 'menu-open' : ''}`}
      onClick={(event) => {
        if (!event.target.closest('button')) onOpenPreview(asset)
      }}
    >
      <div className={`asset-preview ${asset.color}`} onClick={(event) => stopAnd(event, onOpenPreview)} style={{ cursor: 'pointer' }}>
        {asset.kind === 'video' ? (
          <button className="video-thumbnail" type="button" onClick={(event) => stopAnd(event, onOpenPreview)} aria-label={`Preview video ${asset.name}`}>
            <img src={asset.image} alt="" />
            <span aria-hidden="true">▶</span>
          </button>
        ) : (
          asset.image && <img src={asset.image} alt={asset.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <span className="asset-type">{asset.type}</span>
        <button className="card-menu" type="button" onClick={(event) => { event.stopPropagation(); onToggleMenu(asset.name) }} aria-label={`More options for ${asset.name}`}>...</button>
        {isMenuOpen && (
          <AssetCardMenu
            asset={asset}
            activeSection={activeSection}
            canManageWorkspace={canManageWorkspace}
            isAdmin={isAdmin}
            onOpenPreview={onOpenPreview}
            onDownload={onDownload}
            onRename={onRename}
            onEditMetadata={onEditMetadata}
            onRestore={onRestore}
            onPermanentlyDelete={onPermanentlyDelete}
            onRemoveFromCollection={onRemoveFromCollection}
            onAddToCollection={onAddToCollection}
            onDelete={onDelete}
            onClose={() => onToggleMenu(null)}
          />
        )}
      </div>
      <div className="asset-info">
        <div>
          <h2>{asset.name}</h2>
          <p>{asset.size} <span>·</span> {asset.updated}</p>
          {asset.tags?.length > 0 && (
            <div className="asset-tags" aria-label="Asset tags">
              {asset.tags.slice(0, 3).map((tag) => <span className="asset-tag" key={tag}>{tag}</span>)}
              {asset.tags.length > 3 && <span className="asset-tag-more">+{asset.tags.length - 3}</span>}
            </div>
          )}
        </div>
        <div className="asset-card-actions">
          <label className="asset-select" onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(asset)} aria-label={`Select ${asset.name}`} />
          </label>
          {activeSection !== 'trash' && (
            <button className={`star ${isStarred ? 'starred' : ''}`} type="button" onClick={(event) => stopAnd(event, onToggleStar)} aria-label={`${isStarred ? 'Unstar' : 'Star'} ${asset.name}`}>
              {isStarred ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
