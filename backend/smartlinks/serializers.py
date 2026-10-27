from django.conf import settings
from rest_framework import serializers
from .catalog import PLATFORMS, canonical, identify
from .models import Resolution, SmartLink


def normalize_flo_link(item):
    if item.get("platform") != "flo" or not item.get("url"):
        return item
    try:
        key, identifier = identify(item["url"])
    except ValueError:
        return item
    return {**item, "url": canonical(key, identifier)}


class ResolveInputSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=1000)
    country = serializers.RegexField(r"^[A-Za-z]{2}$", default="KR")

    def validate_url(self, value):
        try:
            key, _ = identify(value)
            if key in settings.DISABLED_PROVIDERS:
                raise serializers.ValidationError("현재 자동 검색에서 제외된 플랫폼입니다. 다른 플랫폼의 앨범 주소를 입력해 주세요.")
        except ValueError as error:
            raise serializers.ValidationError(str(error))
        return value

    def validate_country(self, value):
        return value.upper()


class ResolutionSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        result = data["result"]
        if result.get("album"):
            data["result"] = {**result, "album": normalize_flo_link(result["album"]),
                              "platforms": [{**platform, "candidates": [normalize_flo_link(item) for item in platform["candidates"]]} for platform in result.get("platforms", [])]}
        return data

    class Meta:
        model = Resolution
        fields = ["id", "source_url", "country", "status", "result", "error", "created_at"]
        read_only_fields = fields


class PublishSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(child=serializers.UUIDField(), max_length=len(PLATFORMS), default=list)
    manual_urls = serializers.ListField(child=serializers.URLField(max_length=1000), max_length=len(PLATFORMS), default=list)

    def validate_manual_urls(self, values):
        for value in values:
            try:
                identify(value)
            except ValueError as error:
                raise serializers.ValidationError(str(error))
        return values

    def validate(self, attrs):
        if not attrs["candidate_ids"] and not attrs["manual_urls"]:
            raise serializers.ValidationError("발행할 링크를 하나 이상 선택해 주세요.")
        return attrs


class SmartLinkSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["album"] = normalize_flo_link(data["album"])
        data["links"] = [normalize_flo_link(item) for item in data["links"]]
        return data

    class Meta:
        model = SmartLink
        fields = ["slug", "resolution_id", "album", "links", "created_at"]
        read_only_fields = fields
