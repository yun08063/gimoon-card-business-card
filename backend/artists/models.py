from django.conf import settings
from django.db import models

class Artist(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="artists")
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

class ArtistLink(models.Model):
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name="links")
    title = models.CharField(max_length=120)
    platform = models.CharField(max_length=40)
    url = models.URLField()
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
