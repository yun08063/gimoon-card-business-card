from django.contrib import admin
from .models import Resolution, SmartLink


@admin.register(Resolution)
class ResolutionAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "country", "created_at"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(SmartLink)
class SmartLinkAdmin(admin.ModelAdmin):
    list_display = ["slug", "created_at"]
