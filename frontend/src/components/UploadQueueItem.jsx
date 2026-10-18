export default function UploadQueueItem({ item }) {
  return (
    <div className="upload-queue-item">
      <div className="upload-queue-copy">
        <span title={item.name}>{item.name}</span>
        <small>{item.status === 'error' ? item.error : item.progress == null ? item.status : `${item.status} · ${item.progress}%`}</small>
      </div>
      <progress max="100" value={item.progress ?? 0} aria-label={`${item.name} upload progress`} />
    </div>
  )
}
