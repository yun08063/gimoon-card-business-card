import base64
import json
import os
import re
from urllib.parse import urlencode, urljoin, unquote_plus
from django.conf import settings
from django.core.cache import cache
from selectolax.lexbor import LexborHTMLParser
from .catalog import ProviderError, canonical, identify, lastfm_id
from .network import get_json, permitted_html, request
from .matching import artist_aliases, artists_match


def album(key, identifier, title, artist, *, country="KR", cover="", date="", count=None, upc="", tracks=None):
    if not title or not artist:
        raise ProviderError("앨범명·아티스트를 확인할 수 없습니다. 플랫폼 페이지 구조를 확인해야 합니다.", "unavailable")
    return {"platform": key, "external_id": str(identifier), "title": title.strip(), "artist": artist.strip(),
            "url": canonical(key, identifier, country), "cover": cover if cover.startswith("https://") else "",
            "release_date": date, "track_count": count, "upc": upc, "tracks": tracks or []}


def album_query(source):
    """Prefer artist-qualified album searches to reduce common-title noise."""
    return f'{source["artist"]} {source["title"]}'.strip()


class Apple:
    key = "apple"

    def convert(self, item, country):
        return album(self.key, item["collectionId"], item["collectionName"], item["artistName"], country=country,
                     cover=item.get("artworkUrl100", ""), date=item.get("releaseDate", "")[:10], count=item.get("trackCount"))

    def lookup(self, identifier, country):
        data = get_json("https://itunes.apple.com/lookup?" + urlencode({"id": identifier, "entity": "song", "country": country, "limit": 200}))
        collections = [item for item in data.get("results", []) if item.get("wrapperType") == "collection"]
        if not collections:
            raise ProviderError("선택한 국가의 Apple 카탈로그에서 앨범을 찾지 못했습니다.", "not_found")
        result = self.convert(collections[0], country)
        result["tracks"] = [{"title": t["trackName"], "duration_ms": t.get("trackTimeMillis")} for t in data["results"] if t.get("wrapperType") == "track" and t.get("trackName")]
        return result

    def search(self, source, country):
        query = {"term": album_query(source), "entity": "album", "country": country, "limit": 5}
        return [self.convert(item, country) for item in get_json("https://itunes.apple.com/search?" + urlencode(query)).get("results", []) if item.get("collectionId")]


class Deezer:
    key = "deezer"

    def convert(self, item, country):
        if item.get("error"):
            raise ProviderError("Deezer에서 앨범을 찾지 못했습니다.", "not_found")
        return album(self.key, item["id"], item["title"], item.get("artist", {}).get("name", ""),
                     cover=item.get("cover_xl", item.get("cover_medium", "")), date=item.get("release_date", ""),
                     count=item.get("nb_tracks"), upc=item.get("upc", ""),
                     tracks=[{"title": t["title"], "duration_ms": t.get("duration", 0)*1000, "isrc": t.get("isrc", "")} for t in item.get("tracks", {}).get("data", [])])

    def lookup(self, identifier, country):
        return self.convert(get_json(f"https://api.deezer.com/album/{identifier}"), country)

    def search(self, source, country):
        # Album search treats combined artist/title keywords too loosely. Search
        # tracks with explicit fields, then resolve their distinct album IDs.
        title = source["title"].replace('"', " ")
        for artist in artist_aliases(source["artist"]):
            artist = artist.replace('"', " ")
            query = {"q": f'artist:"{artist}" album:"{title}"', "limit": 10}
            data = get_json("https://api.deezer.com/search?" + urlencode(query))
            if data.get("error"):
                raise ProviderError("Deezer 검색을 이용할 수 없습니다.", "unavailable")
            ids = list(dict.fromkeys(str(item["album"]["id"]) for item in data.get("data", []) if item.get("album", {}).get("id")))[:3]
            candidates = [self.lookup(identifier, country) for identifier in ids]
            candidates = [item for item in candidates if artists_match(source["artist"], item["artist"])]
            if candidates:
                return candidates
        return []


class Spotify:
    key = "spotify"

    def headers(self):
        token = cache.get("spotify:token")
        if not token:
            client, secret = os.environ.get("SPOTIFY_CLIENT_ID"), os.environ.get("SPOTIFY_CLIENT_SECRET")
            if not client or not secret:
                raise ProviderError("SPOTIFY_CLIENT_ID와 SPOTIFY_CLIENT_SECRET 설정이 필요합니다.", "credentials_required")
            credentials = base64.b64encode(f"{client}:{secret}".encode()).decode()
            data = get_json("https://accounts.spotify.com/api/token", method="POST", headers={"Authorization": f"Basic {credentials}"}, data={"grant_type": "client_credentials"})
            token = data.get("access_token")
            if not token:
                raise ProviderError("Spotify 인증에 실패했습니다.", "credentials_required")
            cache.set("spotify:token", token, max(1, int(data.get("expires_in", 3600)) - 60))
        return {"Authorization": f"Bearer {token}"}

    def lookup(self, identifier, country):
        item = get_json(f"https://api.spotify.com/v1/albums/{identifier}?" + urlencode({"market": country}), headers=self.headers())
        return album(self.key, item["id"], item["name"], ", ".join(a["name"] for a in item.get("artists", [])),
                     cover=next(iter(item.get("images", [])), {}).get("url", ""), date=item.get("release_date", ""),
                     count=item.get("total_tracks"), upc=item.get("external_ids", {}).get("upc", ""),
                     tracks=[{"title": t["name"], "duration_ms": t.get("duration_ms")} for t in item.get("tracks", {}).get("items", [])])

    def search(self, source, country):
        query = "upc:" + source["upc"] if source.get("upc") else album_query(source)
        data = get_json("https://api.spotify.com/v1/search?" + urlencode({"q": query, "type": "album", "market": country, "limit": 3}), headers=self.headers())
        return [self.lookup(item["id"], country) for item in data.get("albums", {}).get("items", [])[:3]]


class KoreanCatalog:
    def __init__(self, key):
        self.key = key

    def fetch(self, url):
        # Domestic catalog pages are fetched directly like the project's 2022
        # reference crawler; the response itself still passes host/HTTP checks.
        return request(url)

    def parse(self, html, identifier, country):
        soup = LexborHTMLParser(html)
        def text(selector):
            element = soup.css_first(selector)
            return element.text(separator=" ", strip=True) if element else ""
        def meta(name):
            element = soup.css_first(f'meta[property="{name}"]')
            return element.attributes.get("content", "") if element else ""
        if self.key == "melon":
            title_element = soup.css_first(".section_info .song_name")
            if title_element:
                for hidden in title_element.css(".none"):
                    hidden.decompose()
            title = title_element.text(separator=" ", strip=True) if title_element else ""
            artist = text(".section_info .artist_name")
            tracks = [t.text(separator=" ", strip=True) for t in soup.css(".wrap_song_info .ellipsis a[href*='playSong']")]
        elif self.key == "bugs":
            parts = meta("og:title").rsplit(" / ", 1)
            title, artist = parts if len(parts) == 2 else ("", "")
            tracks = [t.text(separator=" ", strip=True) for t in soup.css(".trackList .title a")]
        else:
            title = text(".album-detail-infos .name") or text(".info-zone .name")
            artist = text(".info-data .value a[href*='artistInfo']") or text(".info-zone .info-data .value a")
            tracks = [t.text(separator=" ", strip=True) for t in soup.css(".list-wrap .title")]
        # A generic homepage or access-block screen must never become an album.
        if not title or not artist:
            raise ProviderError("앨범 상세 정보를 추출하지 못했습니다. 페이지 구조 변경 또는 접근 제한일 수 있습니다.", "unavailable")
        dates = re.search(r"(?:발매일|발매)[\s\S]{0,100}?(\d{4}[.\-/]\d{2}[.\-/]\d{2})", soup.text(separator=" ", strip=True))
        return album(self.key, identifier, title, artist, cover=meta("og:image").replace("http://", "https://", 1),
                     date=dates.group(1).replace(".", "-").replace("/", "-") if dates else "",
                     count=len(tracks) or None, tracks=[{"title": title} for title in tracks])

    def lookup(self, identifier, country):
        url = canonical(self.key, identifier, country)
        return self.parse(self.fetch(url), identifier, country)

    def search(self, source, country):
        term = album_query(source)
        urls = {
            "melon": "https://www.melon.com/search/total/index.htm?" + urlencode({"q": term}),
            "genie": "https://www.genie.co.kr/search/searchAlbum?" + urlencode({"query": term}),
            "bugs": "https://music.bugs.co.kr/search/album?" + urlencode({"q": term}),
        }
        html = self.fetch(urls[self.key])
        soup = LexborHTMLParser(html)
        ids = []
        for a in soup.css("a[href], a[onclick]"):
            attrs = a.attributes
            href = attrs.get("href", "")
            try:
                key, identifier = identify(urljoin(urls[self.key], href).replace("http://", "https://", 1))
                if key != self.key:
                    continue
            except ValueError:
                patterns = {"melon": r"goAlbumDetail\(['\"](\d+)", "genie": r"fnViewAlbumLayer\(['\"](\d+)", "bugs": r"/album/(\d+)"}
                match = re.search(patterns[self.key], href + " " + attrs.get("onclick", ""))
                if not match:
                    continue
                identifier = match.group(1)
            if identifier not in ids:
                ids.append(identifier)
            if len(ids) == 2:
                break
        results = [self.lookup(identifier, country) for identifier in ids]
        if not results:
            raise ProviderError("검색 결과가 없거나 검색 페이지의 구조가 변경되었습니다.", "not_found")
        return results



class Flo:
    """Experimental public web catalog. Not an official partner API contract."""
    key = "flo"

    def convert(self, item, country):
        date = item.get("releaseYmd", "")
        if len(date) == 8:
            date = f"{date[:4]}-{date[4:6]}-{date[6:]}"
        images = item.get("imgList", [])
        image = max(images, key=lambda image: image.get("size", 0), default={})
        artist = ", ".join(a["name"] for a in item.get("artistList", [])) or item.get("representationArtist", {}).get("name", "")
        return album(self.key, item["id"], item["title"], artist, cover=image.get("url", ""), date=date)

    def lookup(self, identifier, country):
        data = get_json(f"https://www.music-flo.com/api/meta/v1/album/{identifier}")
        if data.get("code") != "2000000" or not data.get("data"):
            raise ProviderError("FLO에서 앨범을 찾지 못했습니다.", "not_found")
        return self.convert(data["data"], country)

    def search(self, source, country):
        # The reference crawler uses integration search and tries individual artists.
        artists = [source["artist"], *[part.strip() for part in source["artist"].split(",") if part.strip()]]
        artists = list(dict.fromkeys(artists))[:3]
        for artist in artists:
            query = {"keyword": f"{artist} {source['title']}", "searchType": "ALBUM", "size": 3}
            for endpoint in ("integration", ""):
                path = "/api/search/v2/search" + ("/integration" if endpoint else "")
                data = get_json("https://www.music-flo.com" + path + "?" + urlencode(query))
                if data.get("code") != "2000000":
                    raise ProviderError("FLO 검색을 이용할 수 없습니다.", "unavailable")
                items = [item for group in data.get("data", {}).get("list", []) if group.get("type") == "ALBUM" for item in group.get("list", [])]
                ids = list(dict.fromkeys(str(item["id"]) for item in items))[:3]
                if ids:
                    return [self.lookup(identifier, country) for identifier in ids]
        return []


class Lastfm:
    """Album metadata, not a streaming provider. All matches still need review."""
    key = "lastfm"

    def call(self, method, **parameters):
        key = os.environ.get("LASTFM_API_KEY", "")
        if not key:
            raise ProviderError("LASTFM_API_KEY 설정이 필요합니다.", "credentials_required")
        query = {"method": method, "api_key": key, "format": "json", **parameters}
        data = get_json("https://ws.audioscrobbler.com/2.0/?" + urlencode(query))
        if data.get("error"):
            code = int(data["error"])
            if code in (4, 9, 10, 26):
                raise ProviderError("Last.fm API 키 또는 접근 권한을 확인해 주세요.", "credentials_required")
            if code == 29:
                raise ProviderError("Last.fm 요청 한도에 도달했습니다.", "rate_limited")
            if code in (6, 7):
                raise ProviderError("Last.fm에서 앨범을 찾지 못했습니다.", "not_found")
            raise ProviderError("Last.fm에서 정보를 가져오지 못했습니다.", "unavailable")
        return data

    def convert(self, item, country):
        artist = item.get("artist", "")
        if isinstance(artist, dict):
            artist = artist.get("name", "")
        title = item.get("name", "")
        images = {image.get("size"): image.get("#text", "") for image in item.get("image", [])}
        cover = next((images.get(size) for size in ("mega", "extralarge", "large", "medium", "small") if images.get(size)), "")
        tracks = item.get("tracks", {}).get("track", [])
        if isinstance(tracks, dict):
            tracks = [tracks]
        normalized_tracks = []
        for track in tracks:
            duration = str(track.get("duration", ""))
            normalized_tracks.append({"title": track.get("name", ""), "duration_ms": int(duration)*1000 if duration.isdigit() and int(duration) > 0 else None})
        result = album(self.key, lastfm_id(artist, title), title, artist, cover=cover,
                       count=len(normalized_tracks) or None, tracks=normalized_tracks)
        # wiki.published is the wiki edit date, not the album release date.
        result["mbid"] = item.get("mbid", "")
        return result

    def lookup(self, identifier, country):
        artist, title = (unquote_plus(part) for part in identifier.split("/", 1))
        data = self.call("album.getInfo", artist=artist, album=title, autocorrect=0)
        if not data.get("album"):
            raise ProviderError("Last.fm에서 앨범 정보를 찾지 못했습니다.", "not_found")
        return self.convert(data["album"], country)

    def search(self, source, country):
        data = self.call("album.search", album=source["title"], limit=10)
        items = data.get("results", {}).get("albummatches", {}).get("album", [])
        if isinstance(items, dict):
            items = [items]
        # The shared matching layer checks artist/title and preserves review status.
        results = []
        seen = set()
        for item in items:
            candidate = self.convert(item, country)
            if candidate["external_id"] not in seen:
                results.append(candidate)
                seen.add(candidate["external_id"])
        return results


class YouTubeMusic:
    """Unofficial YouTube Music metadata adapter backed by ytmusicapi."""
    key = "youtube"

    def client(self):
        try:
            from ytmusicapi import YTMusic
        except ImportError:
            raise ProviderError("YouTube Music 검색 라이브러리가 설치되지 않았습니다.", "unavailable") from None
        return YTMusic()

    def convert(self, item, country):
        artists = item.get("artists", [])
        artist = item.get("artist", "") or ", ".join(part.get("name", "") for part in artists)
        identifier = item.get("browseId") or item.get("albumId") or item.get("playlistId", "")
        if identifier.startswith("VL"):
            identifier = identifier[2:]
        title = item.get("title", "")
        playlist_id = item.get("audioPlaylistId") or item.get("playlistId") or identifier
        thumbnails = item.get("thumbnails", [])
        result = album(self.key, identifier, title, artist, country=country,
                       cover=thumbnails[-1].get("url", "") if thumbnails else "",
                       date=str(item.get("year", "")))
        result["url"] = f"https://music.youtube.com/playlist?list={playlist_id}"
        return result

    def lookup(self, identifier, country):
        if identifier.startswith("OLAK5uy_"):
            playlist_id = identifier
            details = self.client().get_playlist(playlist_id, limit=1)
            title = details.get("title", "")
            author = details.get("author", "")
            if not title or not author:
                raise ProviderError("YouTube Music 재생목록에서 앨범 정보를 찾지 못했습니다.", "not_found")
            result = album(self.key, playlist_id, title, author, country=country)
            result["url"] = f"https://music.youtube.com/playlist?list={playlist_id}"
            return result
        details = self.client().get_album(identifier)
        result = self.convert({**details, "browseId": identifier}, country)
        album_data = details.get("album", details)
        tracks = details.get("tracks", album_data.get("tracks", []))
        result["tracks"] = [{"title": track.get("title", ""), "duration_ms": track.get("duration_seconds", 0) * 1000}
                            for track in tracks if track.get("title")]
        result["track_count"] = len(result["tracks"]) or None
        return result

    def search(self, source, country):
        matches = self.client().search(album_query(source), filter="albums", limit=5)
        return [self.convert(item, country) for item in matches if item.get("browseId")]


class SoundCloud:
    key = "soundcloud"

    def token(self):
        client_id = settings.SOUNDCLOUD_CLIENT_ID
        client_secret = settings.SOUNDCLOUD_CLIENT_SECRET
        if not client_id or not client_secret:
            raise ProviderError("SoundCloud API 앱의 Client ID와 Secret 설정이 필요합니다.", "credentials_required")
        token = cache.get("soundcloud:token")
        if token:
            return token
        credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        data = get_json("https://secure.soundcloud.com/oauth/token", method="POST",
                        headers={"Authorization": f"Basic {credentials}"},
                        data={"grant_type": "client_credentials"})
        token = data.get("access_token")
        if not token:
            raise ProviderError("SoundCloud API 인증에 실패했습니다.", "credentials_required")
        cache.set("soundcloud:token", token, max(1, int(data.get("expires_in", 3600)) - 60))
        return token

    def api(self, path, **parameters):
        token = self.token()
        url = "https://api.soundcloud.com/" + path + ("?" + urlencode(parameters) if parameters else "")
        return get_json(url, headers={"Authorization": f"OAuth {token}"})

    def convert(self, item, country):
        urn = str(item.get("urn", item.get("id", "")))
        title = item.get("title", "")
        artist = item.get("user", {}).get("username", "")
        cover = item.get("artwork_url") or item.get("user", {}).get("avatar_url", "")
        return album(self.key, urn, title, artist, country=country, cover=cover.replace("-large", "-t500x500"))

    def lookup(self, identifier, country):
        url = canonical(self.key, identifier, country)
        if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
            raise ProviderError("SoundCloud 공개 API 자격 증명이 없어 자동 조회를 지원하지 않습니다. 링크를 직접 추가해 주세요.", "credentials_required")
        data = self.api("resolve", url=url)
        if data.get("kind") not in ("playlist", "system-playlist"):
            raise ProviderError("SoundCloud 주소가 앨범 또는 트랙 모음으로 인식되지 않았습니다.", "not_found")
        return self.convert(data, country)

    def search(self, source, country):
        if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
            raise ProviderError("SoundCloud 공개 API 자격 증명이 없어 자동 검색을 지원하지 않습니다.", "credentials_required")
        data = self.api("playlists", q=album_query(source), limit=10)
        return [self.convert(item, country) for item in data.get("collection", []) if item.get("kind") == "playlist"]


class Tidal:
    key = "tidal"

    def token(self):
        if not settings.TIDAL_CLIENT_ID or not settings.TIDAL_CLIENT_SECRET:
            raise ProviderError("TIDAL Developer 앱 Client ID와 Secret 설정이 필요합니다.", "credentials_required")
        token = cache.get("tidal:token")
        if token:
            return token
        credentials = base64.b64encode(
            f"{settings.TIDAL_CLIENT_ID}:{settings.TIDAL_CLIENT_SECRET}".encode()
        ).decode()
        data = get_json("https://auth.tidal.com/v1/oauth2/token", method="POST",
                        headers={"Authorization": f"Basic {credentials}"},
                        data={"grant_type": "client_credentials"})
        token = data.get("access_token")
        if not token:
            raise ProviderError("TIDAL API 인증에 실패했습니다.", "credentials_required")
        cache.set("tidal:token", token, max(1, int(data.get("expires_in", 3600)) - 60))
        return token

    def api(self, path, **parameters):
        return get_json("https://openapi.tidal.com/v2/" + path + "?" + urlencode(parameters),
                        headers={"Authorization": f"Bearer {self.token()}",
                                 "accept": "application/vnd.tidal.v1+json"})

    def convert(self, item, country, included=()):
        attributes = item.get("attributes", item)
        identifier = str(item.get("id", attributes.get("id", "")))
        artists = attributes.get("artists", [])
        if isinstance(artists, dict):
            artists = [artists]
        artist = ", ".join(value.get("name", "") for value in artists if isinstance(value, dict))
        if not artist:
            artist_ids = item.get("relationships", {}).get("artists", {}).get("data", [])
            included_by_id = {str(value.get("id")): value.get("attributes", {}) for value in included}
            artist = ", ".join(included_by_id.get(str(value.get("id")), {}).get("name", "")
                                for value in artist_ids)
        artist = artist or attributes.get("artist", "")
        links = attributes.get("externalLinks", [])
        link = next((entry.get("href", "") for entry in links if "tidal.com" in entry.get("href", "")), "")
        if not link:
            link = f"https://tidal.com/browse/album/{identifier}"
        result = album(self.key, identifier, attributes.get("title", attributes.get("name", "")), artist,
                       country=country, cover=attributes.get("imageCover", ""),
                       date=attributes.get("releaseDate", ""), count=attributes.get("numberOfTracks"))
        result["url"] = link
        return result

    def lookup(self, identifier, country):
        if not settings.TIDAL_CLIENT_ID or not settings.TIDAL_CLIENT_SECRET:
            raise ProviderError("TIDAL 개발자 API를 사용할 수 없어 자동 조회를 지원하지 않습니다. 링크를 직접 추가해 주세요.", "manual_required")
        item = self.api(f"albums/{identifier}", countryCode=settings.TIDAL_COUNTRY_CODE, include="artists")
        return self.convert(item.get("data", item), country, item.get("included", []))

    def search(self, source, country):
        if not settings.TIDAL_CLIENT_ID or not settings.TIDAL_CLIENT_SECRET:
            raise ProviderError("TIDAL 개발자 API를 사용할 수 없어 자동 검색을 지원하지 않습니다.", "manual_required")
        query = album_query(source)
        data = self.api("searchResults", **{"filter[query]": query, "countryCode": settings.TIDAL_COUNTRY_CODE,
                                            "include": "albums,albums.artists"})
        search_result = next(iter(data.get("data", [])), {})
        references = search_result.get("relationships", {}).get("albums", {}).get("data", [])
        included = {str(item.get("id")): item for item in data.get("included", []) if item.get("type") == "albums"}
        if not references:
            references = [{"id": identifier} for identifier in included]
        albums = []
        for reference in references[:5]:
            payload = None
            item = included.get(str(reference.get("id")))
            if not item:
                payload = self.api(f"albums/{reference.get('id')}", countryCode=settings.TIDAL_COUNTRY_CODE,
                                   include="artists")
                item = payload.get("data", {})
            if item:
                albums.append(self.convert(item, country, (payload or {}).get("included", data.get("included", []))))
        return albums


class PublicPageCatalog:
    """Robots-aware fallback for public pages with usable album metadata."""

    SEARCH_URLS = {
        "amazon": "https://music.amazon.com/search/?",
    }

    def __init__(self, key):
        self.key = key

    def fetch(self, url):
        return permitted_html(url)

    def parse(self, html, identifier, country):
        soup = LexborHTMLParser(html)
        for script in soup.css('script[type="application/ld+json"]'):
            try:
                values = json.loads(script.text())
            except (ValueError, TypeError):
                continue
            values = values if isinstance(values, list) else [values]
            for item in values:
                if item.get("@type") not in ("MusicAlbum", "Album"):
                    continue
                artists = item.get("byArtist", [])
                if isinstance(artists, dict):
                    artists = [artists]
                artist = ", ".join(value.get("name", "") for value in artists if isinstance(value, dict))
                image = item.get("image", "")
                if isinstance(image, list):
                    image = image[0] if image else ""
                return album(self.key, identifier, item.get("name", ""), artist, country=country,
                             cover=image, date=item.get("datePublished", ""))

        def meta(*names):
            for name in names:
                element = soup.css_first(f'meta[property="{name}"], meta[name="{name}"]')
                content = element.attributes.get("content", "") if element else ""
                if content:
                    return content.strip()
            return ""

        title = meta("og:title", "twitter:title")
        description = meta("og:description", "description", "twitter:description")
        image = meta("og:image", "twitter:image")
        artist = meta("music:musician", "music:album:artist", "author")
        title = re.sub(r"\s*[|–-]\s*Amazon Music.*$", "", title, flags=re.I).strip()
        if not artist and " by " in title:
            title, artist = title.rsplit(" by ", 1)
        if not artist:
            match = re.search(r"(?:by|아티스트[:：]?)\s+([^|.]+)", description, flags=re.I)
            artist = match.group(1).strip() if match else ""
        if not artist:
            raise ProviderError("공개 페이지에서 아티스트 정보를 확인할 수 없습니다.", "unavailable")
        return album(self.key, identifier, title, artist, country=country, cover=image)

    def lookup(self, identifier, country):
        return self.parse(self.fetch(canonical(self.key, identifier, country)), identifier, country)

    def search(self, source, country):
        query = album_query(source)
        search_url = self.SEARCH_URLS[self.key] + urlencode({"phrase": query})
        html = self.fetch(search_url)
        soup = LexborHTMLParser(html)
        identifiers = []
        for anchor in soup.css("a[href]"):
            href = urljoin(search_url, anchor.attributes.get("href", ""))
            try:
                key, identifier = identify(href)
            except ValueError:
                continue
            if key == self.key and identifier not in identifiers:
                identifiers.append(identifier)
            if len(identifiers) == 5:
                break
        if not identifiers:
            raise ProviderError("검색 페이지에 앨범 링크가 없거나 페이지가 동적으로 생성됩니다.", "unavailable")
        return [self.lookup(identifier, country) for identifier in identifiers]


ADAPTERS = {"lastfm": Lastfm(), "flo": Flo(), "apple": Apple(), "deezer": Deezer(), "spotify": Spotify(),
            "youtube": YouTubeMusic(), "soundcloud": SoundCloud(), "tidal": Tidal(),
            "amazon": PublicPageCatalog("amazon"),
            **{key: KoreanCatalog(key) for key in ("melon", "genie", "bugs")}}
