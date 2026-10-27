from dataclasses import asdict
from django.core import signing
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from .catalog import PLATFORMS, canonical, identify
from .models import Resolution, SmartLink
from .serializers import PublishSerializer, ResolveInputSerializer, ResolutionSerializer, SmartLinkSerializer

TOKEN_SALT = "smartlink-editor-v1"


class ResolutionViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ResolutionSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolution_read"

    def get_throttles(self):
        self.throttle_scope = "resolution_create" if self.action == "create" else "resolution_read"
        return super().get_throttles()

    def get_job(self):
        try:
            identifier = signing.loads(self.request.headers.get("X-Edit-Token", ""), salt=TOKEN_SALT, max_age=7*86400)
        except signing.BadSignature:
            raise PermissionDenied("편집 키가 없거나 만료되었습니다. 새로 검색해 주세요.")
        if identifier != self.kwargs["pk"]:
            raise PermissionDenied("이 검색 결과를 편집할 수 없습니다.")
        job = get_object_or_404(Resolution, pk=self.kwargs["pk"])
        if job.owner_id != self.request.user.pk:
            raise PermissionDenied("이 검색 결과를 관리할 권한이 없습니다.")
        return job

    def create(self, request):
        serializer = ResolveInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = Resolution.objects.create(source_url=serializer.validated_data["url"], country=serializer.validated_data["country"], owner=request.user if request.user.is_authenticated else None)
        return Response({**ResolutionSerializer(job).data, "edit_token": signing.dumps(str(job.id), salt=TOKEN_SALT)}, status=status.HTTP_202_ACCEPTED)

    def retrieve(self, request, pk=None):
        return Response(ResolutionSerializer(self.get_job()).data)

    @action(detail=False, methods=["get"])
    def platforms(self, request):
        platforms = []
        for platform in PLATFORMS:
            mode = "disabled" if platform.key in settings.DISABLED_PROVIDERS else platform.mode
            if platform.key in settings.SEARCH_EXCLUDED_PROVIDERS and mode != "disabled":
                mode = "search_excluded"
            if platform.key == "lastfm" and settings.LASTFM_API_KEY and mode not in ("disabled", "search_excluded"):
                mode = "api_credentials"
            if (platform.key == "tidal" and settings.TIDAL_CLIENT_ID and settings.TIDAL_CLIENT_SECRET
                    and mode not in ("disabled", "search_excluded")):
                mode = "api"
            if platform.key == "soundcloud" and mode not in ("disabled", "search_excluded"):
                mode = "api" if settings.SOUNDCLOUD_CLIENT_ID and settings.SOUNDCLOUD_CLIENT_SECRET else "credentials"
            platforms.append({**asdict(platform), "mode": mode})
        return Response(platforms)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        job = self.get_job()
        if job.status != "ready":
            raise ValidationError("검색이 완료된 후 발행할 수 있습니다.")
        serializer = PublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        candidates = {item["id"]: item for platform in job.result["platforms"] for item in platform["candidates"]}
        links = []
        used = set()
        for identifier in serializer.validated_data["candidate_ids"]:
            candidate = candidates.get(str(identifier))
            if not candidate:
                raise ValidationError("검색 결과에 없는 후보입니다.")
            if candidate["platform"] in used:
                raise ValidationError("플랫폼마다 앨범 하나를 선택해 주세요.")
            used.add(candidate["platform"])
            links.append({"platform": candidate["platform"], "url": candidate["url"], "verification": "user_confirmed"})
        for url in serializer.validated_data["manual_urls"]:
            key, identifier = identify(url)
            if key in used:
                raise ValidationError("플랫폼마다 링크 하나만 등록할 수 있습니다.")
            used.add(key)
            links.append({"platform": key, "url": canonical(key, identifier, job.country) or url, "verification": "manual"})
        with transaction.atomic():
            published, _ = SmartLink.objects.update_or_create(
                resolution=job,
                defaults={
                    "album": job.result["album"],
                    "links": links,
                    "design": serializer.validated_data["design"],
                },
            )
        return Response(SmartLinkSerializer(published).data)


class SmartLinkViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = SmartLinkSerializer
    queryset = SmartLink.objects.all()
    http_method_names = ["get", "head", "options", "put", "patch", "delete"]

    def list(self, request, *args, **kwargs):
        # Public pages can be read only by their unguessable slug, not enumerated.
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied("로그인 후 이용할 수 있습니다.")
        links = SmartLink.objects.filter(resolution__owner=request.user).order_by("-created_at")
        return Response(SmartLinkSerializer(links, many=True).data)

    def get_owned_link(self):
        link = get_object_or_404(SmartLink, slug=self.kwargs["pk"])
        if not self.request.user.is_authenticated or link.resolution.owner_id != self.request.user.pk:
            raise PermissionDenied("이 스마트 링크를 관리할 권한이 없습니다.")
        return link

    @action(detail=True, methods=["put", "patch"], url_path="edit")
    def edit(self, request, pk=None):
        link = self.get_owned_link()
        job = link.resolution
        if job.status != "ready":
            raise ValidationError("검색 결과가 준비된 후 수정할 수 있습니다.")
        serializer = PublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        candidates = {item["id"]: item for platform in job.result["platforms"] for item in platform["candidates"]}
        links = []
        used = set()
        for identifier in serializer.validated_data["candidate_ids"]:
            candidate = candidates.get(str(identifier))
            if not candidate:
                raise ValidationError("검색 결과에 없는 후보입니다.")
            if candidate["platform"] in used:
                raise ValidationError("플랫폼마다 앨범 하나를 선택해 주세요.")
            used.add(candidate["platform"])
            links.append({"platform": candidate["platform"], "url": candidate["url"], "verification": "user_confirmed"})
        for url in serializer.validated_data["manual_urls"]:
            key, identifier = identify(url)
            if key in used:
                raise ValidationError("플랫폼마다 링크 하나만 등록할 수 있습니다.")
            used.add(key)
            links.append({"platform": key, "url": canonical(key, identifier, job.country) or url, "verification": "manual"})
        link.links = links
        link.design = serializer.validated_data["design"]
        link.save(update_fields=["links", "design"])
        return Response(SmartLinkSerializer(link).data)

    def destroy(self, request, *args, **kwargs):
        link = self.get_owned_link()
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="editor")
    def editor(self, request, pk=None):
        link = self.get_owned_link()
        job = link.resolution
        return Response({
            "smartlink": SmartLinkSerializer(link).data,
            "resolution": ResolutionSerializer(job).data,
        })
