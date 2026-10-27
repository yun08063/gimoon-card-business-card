from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from artists.views import ArtistViewSet
from smartlinks.views import ResolutionViewSet, SmartLinkViewSet
router = DefaultRouter()
router.register("artists", ArtistViewSet, basename="artist")
router.register("resolutions", ResolutionViewSet, basename="resolution")
router.register("smartlinks", SmartLinkViewSet, basename="smartlink")
urlpatterns = [path("admin/", admin.site.urls), path("api/auth/", include("accounts.urls")), path("api/", include(router.urls))]
