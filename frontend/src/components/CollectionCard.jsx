export default function CollectionCard({ collection, getCollectionThumbnails, onSelect }) {
  const { imageAssets, imageCount, remainingCount } = getCollectionThumbnails(collection)

  return (
    <button className="collection-card" type="button" onClick={() => onSelect(collection)}>
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
}
