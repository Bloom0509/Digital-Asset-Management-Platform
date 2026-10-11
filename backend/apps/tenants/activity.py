from .models import ActivityEvent


def record_activity(tenant, actor, message, event_type="activity"):
    if tenant is None:
        return None
    return ActivityEvent.objects.create(
        tenant=tenant,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        message=message[:300],
        event_type=event_type,
    )
