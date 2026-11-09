from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from .models import Artist
from .serializers import ArtistSerializer


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.owner_id == request.user.id


class ArtistLibraryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class ArtistViewSet(viewsets.ModelViewSet):
    serializer_class = ArtistSerializer
    lookup_field = "slug"
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    pagination_class = ArtistLibraryPagination

    def get_queryset(self):
        query = Q(is_published=True)
        if self.request.user.is_authenticated:
            query |= Q(owner=self.request.user)
        return Artist.objects.filter(query).prefetch_related("links")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def mine(self, request):
        artists = Artist.objects.filter(owner=request.user).prefetch_related("links")
        query = request.query_params.get("search", "").strip()
        if query:
            artists = artists.filter(
                Q(name__icontains=query)
                | Q(bio__icontains=query)
                | Q(location__icontains=query)
            )
        page = self.paginate_queryset(artists)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)
