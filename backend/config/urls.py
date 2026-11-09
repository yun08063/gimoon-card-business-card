from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.routers import DefaultRouter
from artists.views import ArtistViewSet
from smartlinks.views import LibraryView, ResolutionViewSet, SmartLinkViewSet
router = DefaultRouter()
router.register("artists", ArtistViewSet, basename="artist")
router.register("resolutions", ResolutionViewSet, basename="resolution")
router.register("smartlinks", SmartLinkViewSet, basename="smartlink")
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/library/", LibraryView.as_view(), name="library"),
    path("api/", include(router.urls)),
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
