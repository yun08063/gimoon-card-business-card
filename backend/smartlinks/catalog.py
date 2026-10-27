"""Only canonical album URLs reach adapters. Arbitrary URLs are never fetched."""
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, quote_plus, unquote_plus, urlsplit


@dataclass(frozen=True)
class Platform:
    key: str
    name: str
    region: str
    mode: str


PLATFORMS = [
    Platform("melon", "멜론", "국내", "crawler"),
    Platform("genie", "지니", "국내", "crawler"),
    Platform("bugs", "벅스", "국내", "crawler"),
    Platform("flo", "FLO", "국내", "experimental_api"),
    Platform("spotify", "Spotify", "해외", "credentials"),
    Platform("apple", "Apple Music", "해외", "api"),
    Platform("deezer", "Deezer", "해외", "api"),
    Platform("tidal", "TIDAL", "해외", "manual"),
    Platform("youtube", "YouTube Music", "해외", "experimental_crawler"),
    Platform("amazon", "Amazon Music", "해외", "experimental_crawler"),
    Platform("soundcloud", "SoundCloud", "해외", "credentials"),
    Platform("lastfm", "Last.fm", "해외", "credentials"),
]


class ProviderError(Exception):
    def __init__(self, message, status="error"):
        self.status = status
        super().__init__(message)


FLO_DIGITS = "0123456789"
FLO_LETTERS = "danielzohy"


def flo_numeric_id(identifier):
    if re.fullmatch(r"[0-9]{1,20}", identifier):
        return identifier
    if re.fullmatch(r"[danielzohy]{1,20}", identifier):
        return identifier.translate(str.maketrans(FLO_LETTERS, FLO_DIGITS))
    raise ValueError("잘못된 FLO 앨범 식별자입니다.")


def lastfm_id(artist, title):
    return quote_plus(artist, safe="") + "/" + quote_plus(title, safe="")


def identify(url):
    try:
        p = urlsplit(url)
        if p.scheme != "https" or p.username or p.password or p.port not in (None, 443):
            raise ValueError()
        host = (p.hostname or "").lower()
        path, query = p.path, parse_qs(p.query)
        if host in {"last.fm", "www.last.fm"}:
            match = re.fullmatch(r"/(?:[a-z]{2}/)?music/([^/]+)/([^/]+)/?", path)
            if match and match.group(2) not in {"_", "+albums", "+tracks", "+wiki", "+images"}:
                artist, title = (unquote_plus(part) for part in match.groups())
                if artist.strip() and title.strip():
                    return "lastfm", lastfm_id(artist, title)
            raise ValueError()
        rules = [
            ("spotify", {"open.spotify.com"}, r"/(?:intl-[a-z]{2}/)?album/([A-Za-z0-9]{22})/?", None),
            ("apple", {"music.apple.com", "itunes.apple.com"}, r"/[a-z]{2}/album/(?:[^/]+/)?(?:id)?([0-9]+)/?", None),
            ("deezer", {"www.deezer.com", "deezer.com"}, r"/(?:[a-z]{2}/)?album/([0-9]+)/?", None),
            ("melon", {"www.melon.com", "melon.com"}, r"/album/detail.htm", "albumId"),
            ("genie", {"www.genie.co.kr", "genie.co.kr"}, r"/detail/albumInfo", "axnm"),
            ("bugs", {"music.bugs.co.kr"}, r"/album/([0-9]+)/?", None),
            ("flo", {"www.music-flo.com", "music-flo.com"}, r"/detail/album/([0-9]{1,20}|[danielzohy]{1,20})(?:/albumtrack)?/?", None),
            ("tidal", {"tidal.com", "www.tidal.com", "listen.tidal.com"}, r"/(?:browse/)?album/([0-9]+)/?", None),
            ("youtube", {"music.youtube.com"}, r"/playlist", "list"),
            ("amazon", {"music.amazon.com", "music.amazon.co.uk", "music.amazon.co.jp", "music.amazon.ca", "music.amazon.com.mx", "music.amazon.de", "music.amazon.fr", "music.amazon.it", "music.amazon.es"}, r"/albums/([A-Za-z0-9]+)/?", None),
            ("soundcloud", {"soundcloud.com", "www.soundcloud.com"}, r"/([\w-]+/(?:sets/[\w-]+|[\w-]+))/?", None),
        ]
        for key, hosts, pattern, param in rules:
            match = re.fullmatch(pattern, path)
            if host in hosts and match:
                identifier = query.get(param, [""])[0] if param else match.group(1)
                if not identifier or (param in ("albumId", "axnm") and not identifier.isdigit()):
                    raise ValueError()
                if key == "youtube" and not re.fullmatch(r"[A-Za-z0-9_-]{10,100}", identifier):
                    raise ValueError()
                if key == "flo":
                    identifier = flo_numeric_id(identifier)
                return key, identifier
    except (ValueError, TypeError):
        pass
    raise ValueError("지원 플랫폼의 HTTPS 앨범 상세 주소를 입력해 주세요. 단축 링크와 곡·플레이리스트 주소는 제외합니다. YouTube Music은 앨범 재생목록 주소를 사용합니다.")


def canonical(key, identifier, country="KR"):
    if key == "flo":
        encoded = flo_numeric_id(str(identifier)).translate(str.maketrans(FLO_DIGITS, FLO_LETTERS))
        return f"https://www.music-flo.com/detail/album/{encoded}/albumtrack"
    if key == "lastfm":
        return f"https://www.last.fm/music/{identifier}"
    if key == "soundcloud":
        return f"https://soundcloud.com/{identifier}"
    if key == "tidal":
        return f"https://tidal.com/browse/album/{identifier}"
    if key == "amazon":
        return f"https://music.amazon.com/albums/{identifier}"
    return {
        "spotify": f"https://open.spotify.com/album/{identifier}",
        "apple": f"https://music.apple.com/{country.lower()}/album/{identifier}",
        "deezer": f"https://www.deezer.com/album/{identifier}",
        "melon": f"https://www.melon.com/album/detail.htm?albumId={identifier}",
        "genie": f"https://www.genie.co.kr/detail/albumInfo?axnm={identifier}",
        "bugs": f"https://music.bugs.co.kr/album/{identifier}",
    }.get(key)
