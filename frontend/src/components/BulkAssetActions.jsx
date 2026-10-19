export default function BulkAssetActions({
  count,
  isTrash,
  canManageWorkspace,
  isAdmin,
  allStarred,
  onAddToCollection,
  onToggleFavorites,
  onMoveToTrash,
  onRestore,
  onDeletePermanently,
  onClear,
}) {
  if (!count) return null

  return (
    <div className="bulk-actions" role="toolbar" aria-label="Actions for selected assets">
      <strong>{count} selected</strong>
      {!isTrash && <button type="button" onClick={onToggleFavorites}>{allStarred ? 'Remove favorites' : 'Add to favorites'}</button>}
      {canManageWorkspace && !isTrash && <>
        <button type="button" onClick={onAddToCollection}>Add to collection</button>
        <button className="bulk-danger" type="button" onClick={onMoveToTrash}>Move to trash</button>
      </>}
      {canManageWorkspace && isTrash && <button type="button" onClick={onRestore}>Restore</button>}
      {isTrash && isAdmin && <button className="bulk-danger" type="button" onClick={onDeletePermanently}>Delete permanently</button>}
      <button type="button" onClick={onClear}>Clear selection</button>
    </div>
  )
}
