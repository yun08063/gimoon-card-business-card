import uuid
from django.conf import settings
from django.db import models


class Resolution(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="smartlink_resolutions")
    source_url = models.URLField(max_length=1000)
    country = models.CharField(max_length=2, default="KR")
    status = models.CharField(max_length=20, default="queued")
    result = models.JSONField(default=dict)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SmartLink(models.Model):
    slug = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resolution = models.OneToOneField(Resolution, on_delete=models.CASCADE)
    album = models.JSONField()
    links = models.JSONField()
    design = models.CharField(
        max_length=20,
        choices=[("classic", "Classic"), ("split", "Album left")],
        default="classic",
    )
    created_at = models.DateTimeField(auto_now_add=True)
