import json
import urllib.robotparser
from urllib.parse import urlsplit
from django.core.cache import cache
import httpx
from .catalog import ProviderError

ALLOWED_HOSTS = {
    "api.spotify.com", "accounts.spotify.com", "itunes.apple.com", "api.deezer.com",
    "www.melon.com", "www.genie.co.kr", "music.bugs.co.kr", "www.music-flo.com", "ws.audioscrobbler.com",
    "api.soundcloud.com", "auth.soundcloud.com", "secure.soundcloud.com",
    "music.amazon.com", "music.amazon.co.uk", "music.amazon.co.jp", "music.amazon.ca", "music.amazon.com.mx",
    "music.amazon.de", "music.amazon.fr", "music.amazon.it", "music.amazon.es",
    "music.amazon.co.uk", "music.amazon.co.jp", "openapi.tidal.com", "auth.tidal.com",
    "soundcloud.com", "www.soundcloud.com",
}
MAX_BYTES = 3_000_000
USER_AGENT = "GimoonSmartLink/0.1"


def request(url, *, method="GET", headers=None, data=None):
    p = urlsplit(url)
    if p.scheme != "https" or p.hostname not in ALLOWED_HOSTS or p.port not in (None, 443) or p.username or p.password:
        raise ProviderError("허용되지 않은 데이터 제공 주소입니다.")
    try:
        with httpx.Client(timeout=httpx.Timeout(10, connect=4), follow_redirects=False, trust_env=False) as client:
            with client.stream(method, url, headers={"User-Agent": USER_AGENT, **(headers or {})}, data=data) as response:
                if response.status_code == 429:
                    raise ProviderError("요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", "rate_limited")
                if response.status_code in (401, 403):
                    raise ProviderError("인증 또는 접근 권한이 필요합니다.", "blocked")
                if 300 <= response.status_code < 400:
                    raise ProviderError("플랫폼에서 다른 주소로 이동시켰습니다. 원본 앨범 주소를 확인해 주세요.", "blocked")
                response.raise_for_status()
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        raise ProviderError("응답 크기 제한을 초과했습니다.")
                return bytes(body).decode(response.encoding or "utf-8", errors="replace")
    except httpx.HTTPError:
        raise ProviderError("플랫폼 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.") from None


def get_json(url, **kwargs):
    try:
        result = json.loads(request(url, **kwargs))
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (ValueError, TypeError):
        raise ProviderError("플랫폼의 데이터 형식이 변경되었습니다.") from None


def permitted_html(url):
    p = urlsplit(url)
    origin = f"https://{p.hostname}"
    key = "robots:" + p.hostname
    robots = cache.get(key)
    if robots is None:
        robots = request(origin + "/robots.txt")
        cache.set(key, robots, 3600)
    policy = urllib.robotparser.RobotFileParser()
    policy.parse(robots.splitlines())
    if not policy.can_fetch(USER_AGENT, url):
        raise ProviderError("robots.txt에서 수집을 허용하지 않는 주소입니다. 직접 링크를 추가해 주세요.", "blocked")
    return request(url)
