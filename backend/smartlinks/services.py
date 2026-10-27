import logging
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.conf import settings
from .catalog import PLATFORMS, ProviderError, identify
from .matching import score
from .providers import ADAPTERS

logger = logging.getLogger(__name__)


def resolve(source_url, country):
    key, identifier = identify(source_url)
    if key in settings.DISABLED_PROVIDERS:
        raise ProviderError("현재 자동 검색에서 제외된 플랫폼입니다. 다른 플랫폼의 앨범 주소를 입력해 주세요.", "disabled")
    if key == "tidal" and not (settings.TIDAL_CLIENT_ID and settings.TIDAL_CLIENT_SECRET):
        raise ProviderError("TIDAL 개발자 API를 사용할 수 없어 자동 조회를 지원하지 않습니다. 링크를 직접 추가해 주세요.", "manual_required")
    adapter = ADAPTERS.get(key)
    if not adapter:
        raise ProviderError("이 플랫폼의 원본 자동 수집은 아직 연결되지 않았습니다. 지원하는 앨범 주소로 시작하고, 결과에서 이 플랫폼 링크를 직접 추가해 주세요.", "manual_required")
    source = adapter.lookup(identifier, country)
    source_candidate = {**source, "id": str(uuid.uuid4()), "score": 100, "evidence": ["입력한 원본 앨범"], "match_status": "source"}
    results = [{"key": key, "status": "source", "message": "입력한 원본 앨범", "candidates": [source_candidate]}]

    def search(platform):
        if platform.key in settings.DISABLED_PROVIDERS:
            return {"key": platform.key, "status": "disabled", "message": "설정에 따라 자동 검색에서 제외했습니다.", "candidates": []}
        if platform.key in settings.SEARCH_EXCLUDED_PROVIDERS:
            return {"key": platform.key, "status": "disabled", "message": "설정에 따라 다른 플랫폼 앨범 검색에서 제외했습니다.", "candidates": []}
        if platform.key == "tidal" and not (settings.TIDAL_CLIENT_ID and settings.TIDAL_CLIENT_SECRET):
            return {"key": platform.key, "status": "manual_required", "message": "개발자 API를 사용할 수 없어 직접 링크를 추가해 주세요.", "candidates": []}
        if platform.key not in ADAPTERS:
            return {"key": platform.key, "status": "manual_required", "message": "자동 연동 준비 중 · 직접 앨범 링크를 추가할 수 있습니다.", "candidates": []}
        try:
            found = ADAPTERS[platform.key].search(source, country)
            candidates = []
            for item in found:
                value, evidence, status = score(source, item)
                if value >= 55:
                    candidates.append({**item, "id": str(uuid.uuid4()), "score": value, "evidence": evidence, "match_status": status})
            candidates.sort(key=lambda item: item["score"], reverse=True)
            return {"key": platform.key, "status": "found" if candidates else "not_found", "message": "같은 앨범인지 확인해 주세요." if candidates else "일치하는 후보를 찾지 못했습니다.", "candidates": candidates}
        except ProviderError as error:
            return {"key": platform.key, "status": error.status, "message": str(error), "candidates": []}
        except Exception:
            logger.exception("Provider search failed: %s", platform.key)
            return {"key": platform.key, "status": "error", "message": "데이터 처리에 실패했습니다. 직접 링크를 추가할 수 있습니다.", "candidates": []}

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(search, platform) for platform in PLATFORMS if platform.key != key]
        for future in as_completed(futures):
            results.append(future.result())
    order = {platform.key: i for i, platform in enumerate(PLATFORMS)}
    results.sort(key=lambda item: order[item["key"]])
    return {"album": source, "platforms": results, "country": country}
