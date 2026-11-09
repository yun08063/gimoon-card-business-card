import json
from django.utils.text import slugify
from rest_framework import serializers
from .models import Artist, ArtistLink


class ArtistLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArtistLink
        fields = ["id", "title", "platform", "url", "position"]
        read_only_fields = ["id"]


class ArtistSerializer(serializers.ModelSerializer):
    links = ArtistLinkSerializer(many=True, required=False)
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    image_url = serializers.SerializerMethodField()
    remove_image = serializers.BooleanField(required=False, write_only=True)
    slug = serializers.SlugField(required=False)

    class Meta:
        model = Artist
        fields = [
            "id",
            "name",
            "slug",
            "bio",
            "location",
            "image",
            "image_url",
            "remove_image",
            "is_published",
            "links",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "image_url"]

    def to_internal_value(self, data):
        raw_links = data.get("links") if hasattr(data, "get") else None
        if isinstance(raw_links, str):
            try:
                links = json.loads(raw_links)
            except json.JSONDecodeError as error:
                raise serializers.ValidationError(
                    {"links": "링크 형식이 올바르지 않습니다."}
                ) from error
            data = {key: data.get(key) for key in data.keys()}
            data["links"] = links
        return super().to_internal_value(data)

    def get_image_url(self, obj):
        return obj.image.url if obj.image else ""

    def validate_image(self, image):
        if image and image.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("이미지는 5MB 이하로 올려 주세요.")
        return image

    def validate_slug(self, value):
        existing = Artist.objects.filter(slug=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError(
                "이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해 주세요."
            )
        return value

    def create(self, validated_data):
        links = validated_data.pop("links", [])
        validated_data.pop("remove_image", None)
        slug = validated_data.pop("slug", "") or slugify(validated_data["name"])[:48]
        if not slug:
            import uuid

            slug = f"artist-{uuid.uuid4().hex[:8]}"
        base_slug = slug
        suffix = 2
        while Artist.objects.filter(slug=slug).exists():
            slug = f"{base_slug[:55]}-{suffix}"
            suffix += 1
        artist = Artist.objects.create(slug=slug, **validated_data)
        self._replace_links(artist, links)
        return artist

    def update(self, instance, validated_data):
        links = validated_data.pop("links", None)
        remove_image = validated_data.pop("remove_image", False)
        if remove_image and instance.image:
            instance.image.delete(save=False)
            instance.image = None
        image = validated_data.get("image")
        if image and instance.image:
            instance.image.delete(save=False)
        instance = super().update(instance, validated_data)
        if links is not None:
            self._replace_links(instance, links)
        instance.refresh_from_db()
        return instance

    @staticmethod
    def _replace_links(artist, links):
        artist.links.all().delete()
        ArtistLink.objects.bulk_create(
            [
                ArtistLink(artist=artist, **{**link, "position": position})
                for position, link in enumerate(links)
            ]
        )
