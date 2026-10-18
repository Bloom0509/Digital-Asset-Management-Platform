export default function ActivityItem({ activity }) {
  return (
    <article className="activity-item">
      <span className={`activity-icon ${activity.type}`}>{activity.type === 'error' ? '!' : '◷'}</span>
      <div>
        <p>{activity.message}</p>
        <time>{activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Just now'}</time>
      </div>
    </article>
  )
}
