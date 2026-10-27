from rest_framework import serializers
from .models import Artist, ArtistLink

class ArtistLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArtistLink
        fields = ["id", "title", "platform", "url", "position"]

class ArtistSerializer(serializers.ModelSerializer):
    links = ArtistLinkSerializer(many=True, read_only=True)

    class Meta:
        model = Artist
        fields = ["id", "name", "slug", "bio", "location", "is_published", "links", "created_at"]
        read_only_fields = ["id", "created_at"]
