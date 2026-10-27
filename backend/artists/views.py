from django.db.models import Q
from rest_framework import permissions, viewsets
from .models import Artist
from .serializers import ArtistSerializer

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.owner_id == request.user.id

class ArtistViewSet(viewsets.ModelViewSet):
    serializer_class = ArtistSerializer
    lookup_field = "slug"
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        query = Q(is_published=True)
        if self.request.user.is_authenticated:
            query |= Q(owner=self.request.user)
        return Artist.objects.filter(query).prefetch_related("links")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
