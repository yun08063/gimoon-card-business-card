from django.contrib import admin
from .models import Artist, ArtistLink

class ArtistLinkInline(admin.TabularInline):
    model = ArtistLink
    extra = 1

@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "owner", "is_published"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ArtistLinkInline]
