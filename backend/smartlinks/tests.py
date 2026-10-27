from copy import deepcopy
from unittest.mock import patch
from django.core import signing
from django.core.cache import cache
from django.core.management import call_command
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from rest_framework.test import APITestCase
from .catalog import PLATFORMS, ProviderError, canonical, identify
from .matching import score
from .models import Resolution
from .network import request
from .providers import Apple, Deezer, Flo, KoreanCatalog, Lastfm
from .services import resolve
from .views import TOKEN_SALT

ALBUM = {"platform": "apple", "external_id": "123", "title": "Blue", "artist": "Artist", "url": "https://music.apple.com/kr/album/123", "cover": "", "upc": "0012345", "release_date": "2024-01-01", "track_count": 10, "tracks": []}
CANDIDATE_ID = "fbc71504-53fe-4373-b398-8201a9555e27"
RESULT = {"album": ALBUM, "platforms": [{"key": "apple", "status": "source", "message": "", "candidates": [{**ALBUM, "id": CANDIDATE_ID}]}]}


class URLAndMatchingTests(SimpleTestCase):
    def test_supported_urls(self):
        examples = {
            "https://www.melon.com/album/detail.htm?albumId=11402655": ("melon", "11402655"),
            "https://www.genie.co.kr/detail/albumInfo?axnm=123": ("genie", "123"),
            "https://music.bugs.co.kr/album/123": ("bugs", "123"),
            "https://music.apple.com/us/album/blue/123": ("apple", "123"),
            "https://open.spotify.com/intl-ko/album/4aawyAB9vmqN3uQ7FjRGTy?si=x": ("spotify", "4aawyAB9vmqN3uQ7FjRGTy"),
            "https://music.youtube.com/playlist?list=OLAK5uy_1234567890": ("youtube", "OLAK5uy_1234567890"),
        }
        for url, expected in examples.items():
            with self.subTest(url=url):
                self.assertEqual(identify(url), expected)

    def test_rejects_ssrf_credentials_shortlinks_and_non_albums(self):
        for url in ["https://localhost/album/1", "http://169.254.169.254/", "https://music.apple.com.evil.test/us/album/123", "https://user:secret@music.apple.com/us/album/123", "https://music.apple.com:8443/us/album/123", "https://open.spotify.com/track/4aawyAB9vmqN3uQ7FjRGTy", "https://spotify.link/example", "https://www.melon.com/album/detail.htm?albumId=../private"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                identify(url)
        with self.assertRaises(ProviderError):
            request("https://127.0.0.1/internal")

    def test_upc_conflict_never_matches_even_when_text_identical(self):
        self.assertEqual(score(ALBUM, {**ALBUM, "upc": "99999"})[0], 0)

    def test_matching_upc_normalizes_leading_zeros(self):
        self.assertEqual(score(ALBUM, {**ALBUM, "upc": "12345"})[2], "matched")

    def test_matching_upc_with_edition_conflict_needs_review(self):
        self.assertEqual(score(ALBUM, {**ALBUM, "title": "Blue (Deluxe)"})[2], "review")
        self.assertEqual(score(ALBUM, {**ALBUM, "track_count": 12})[2], "review")

    def test_identical_text_without_upc_still_needs_review(self):
        self.assertEqual(score({**ALBUM, "upc": ""}, {**ALBUM, "upc": ""})[2], "review")

    def test_korean_metadata_parser_rejects_homepage(self):
        with self.assertRaises(ProviderError):
            KoreanCatalog("melon").parse('<meta property="og:title" content="멜론">', "123", "KR")
        result = KoreanCatalog("melon").parse('<div class="section_info"><div class="song_name"><strong class="none">앨범명</strong>Blue</div><a class="artist_name">Artist</a></div><dt>발매일</dt><dd>2024.01.01</dd>', "123", "KR")
        self.assertEqual(result["title"], "Blue")
        self.assertEqual(result["release_date"], "2024-01-01")

    @override_settings(DISABLED_PROVIDERS=set())
    @patch("smartlinks.services.ADAPTERS")
    def test_provider_failure_isolated_and_manual_platforms_retained(self, adapters):
        class Fake:
            def lookup(self, identifier, country):
                return deepcopy(ALBUM)
            def search(self, source, country):
                raise ProviderError("API key missing", "credentials_required")
        adapters.get.side_effect = lambda key: Fake() if key == "apple" else None
        adapters.__contains__.side_effect = lambda key: key in ("apple", "spotify")
        adapters.__getitem__.side_effect = lambda key: Fake()
        result = resolve(ALBUM["url"], "KR")
        self.assertEqual(len(result["platforms"]), len(PLATFORMS))
        statuses = {item["key"]: item["status"] for item in result["platforms"]}
        self.assertEqual(statuses["spotify"], "credentials_required")
        self.assertNotIn("vibe", statuses)


class ProviderContractTests(SimpleTestCase):
    @patch.dict("os.environ", {"APPLE_MUSIC_DEVELOPER_TOKEN": "test-token"})
    @patch("smartlinks.providers.get_json")
    def test_apple_uses_official_upc_endpoint_with_configured_token(self, get_json):
        get_json.return_value = {"data": [{"id": "123", "attributes": {"name": "Blue", "artistName": "Artist", "upc": "0012345", "trackCount": 10, "artwork": {"url": "https://example.com/{w}x{h}.jpg"}}}]}
        found = Apple().search(ALBUM, "KR")
        request_url = get_json.call_args.args[0]
        self.assertIn("api.music.apple.com/v1/catalog/kr/albums?", request_url)
        self.assertIn("filter%5Bupc%5D=0012345", request_url)
        self.assertEqual(get_json.call_args.kwargs["headers"]["Authorization"], "Bearer test-token")
        self.assertEqual(found[0]["upc"], "0012345")
        self.assertEqual(found[0]["cover"], "https://example.com/600x600.jpg")

    def test_flo_metadata_keeps_unknown_track_count_unknown(self):
        item = {"id": 8003203, "title": "Discovery", "artistList": [{"name": "Daft Punk"}], "releaseYmd": "20010313", "imgList": [{"size": 75, "url": "https://example.com/small"}, {"size": 1000, "url": "https://example.com/large"}]}
        result = Flo().convert(item, "KR")
        self.assertEqual(result["release_date"], "2001-03-13")
        self.assertIsNone(result["track_count"])
        self.assertEqual(result["cover"], "https://example.com/large")
        self.assertEqual(identify(result["url"]), ("flo", "8003203"))


class SmartLinkFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.job = Resolution.objects.create(source_url=ALBUM["url"], status="ready", result=deepcopy(RESULT))
        self.token = signing.dumps(str(self.job.id), salt=TOKEN_SALT)
        self.path = f"/api/resolutions/{self.job.id}/"

    def test_creation_queues_without_fetching_in_request(self):
        response = self.client.post("/api/resolutions/", {"url": ALBUM["url"], "country": "us"})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "queued")
        self.assertEqual(response.data["country"], "US")
        self.assertIn("edit_token", response.data)

    def test_private_draft_requires_correct_token(self):
        self.assertEqual(self.client.get(self.path).status_code, 403)
        wrong = signing.dumps("another-id", salt=TOKEN_SALT)
        self.assertEqual(self.client.get(self.path, HTTP_X_EDIT_TOKEN=wrong).status_code, 403)
        self.assertEqual(self.client.get(self.path, HTTP_X_EDIT_TOKEN=self.token).status_code, 200)

    def test_publish_is_idempotent_and_public_payload_has_no_editor_token(self):
        payload = {"candidate_ids": [CANDIDATE_ID]}
        response = self.client.post(self.path + "publish/", payload, format="json", HTTP_X_EDIT_TOKEN=self.token)
        self.assertEqual(response.status_code, 200)
        second = self.client.post(self.path + "publish/", payload, format="json", HTTP_X_EDIT_TOKEN=self.token)
        self.assertEqual(response.data["slug"], second.data["slug"])
        public = self.client.get(f'/api/smartlinks/{response.data["slug"]}/')
        self.assertEqual(public.status_code, 200)
        self.assertNotIn("edit_token", public.data)
        self.assertNotIn("resolution", public.data)
        self.assertEqual(self.client.get("/api/smartlinks/").status_code, 405)

    def test_rejects_unknown_candidates_and_duplicate_platforms(self):
        for payload in [{"candidate_ids": ["00000000-0000-0000-0000-000000000000"]}, {"candidate_ids": [CANDIDATE_ID], "manual_urls": [ALBUM["url"]]}, {"manual_urls": ["https://127.0.0.1/private"]}, {}]:
            response = self.client.post(self.path + "publish/", payload, format="json", HTTP_X_EDIT_TOKEN=self.token)
            self.assertEqual(response.status_code, 400, response.data)

    def test_manual_link_is_labeled_and_not_fetched(self):
        response = self.client.post(self.path + "publish/", {"manual_urls": ["https://music.amazon.com/albums/B0123456789"]}, format="json", HTTP_X_EDIT_TOKEN=self.token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["links"][0]["verification"], "manual")

class WorkerTests(TransactionTestCase):
    def setUp(self):
        self.job = Resolution.objects.create(source_url=ALBUM["url"], status="ready", result=deepcopy(RESULT))

    @patch("smartlinks.management.commands.resolve_smartlinks.resolve", return_value=RESULT)
    def test_worker_processes_persisted_job(self, resolver):
        self.job.status = "queued"
        self.job.save()
        call_command("resolve_smartlinks", once=True)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "ready")
        resolver.assert_called_once_with(ALBUM["url"], "KR")

    @patch("smartlinks.management.commands.resolve_smartlinks.resolve", side_effect=ProviderError("원본 조회 실패"))
    def test_worker_failure_is_visible(self, resolver):
        self.job.status = "queued"
        self.job.save()
        call_command("resolve_smartlinks", once=True)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "failed")
        self.assertEqual(self.job.error, "원본 조회 실패")


class FloAndLastfmReferenceTests(SimpleTestCase):
    def test_flo_letter_links_roundtrip_and_legacy_numeric_links(self):
        url = canonical("flo", "8003203")
        self.assertEqual(url, "https://www.music-flo.com/detail/album/hddindi/albumtrack")
        self.assertEqual(identify(url), ("flo", "8003203"))
        self.assertEqual(identify("https://www.music-flo.com/detail/album/8003203/albumtrack"), ("flo", "8003203"))
        for invalid in ("invalid", "h00ind i", "../../internal"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                identify(f"https://www.music-flo.com/detail/album/{invalid}/albumtrack")

    @patch("smartlinks.providers.get_json")
    def test_flo_uses_integration_search_and_preserves_multiple_candidates(self, get_json):
        get_json.return_value = {"code": "2000000", "data": {"list": [{"type": "TRACK", "list": [{"id": 999}]}, {"type": "ALBUM", "list": [{"id": 1}, {"id": 2}, {"id": 1}]}]}}
        adapter = Flo()
        with patch.object(adapter, "lookup", side_effect=lambda identifier, country: {"id": identifier}) as lookup:
            self.assertEqual(adapter.search(ALBUM, "KR"), [{"id": "1"}, {"id": "2"}])
        self.assertIn("/search/integration?", get_json.call_args.args[0])
        self.assertEqual(lookup.call_count, 2)

    @patch("smartlinks.providers.get_json")
    def test_flo_empty_results_try_remaining_artists(self, get_json):
        empty = {"code": "2000000", "data": {"list": []}}
        found = {"code": "2000000", "data": {"list": [{"type": "ALBUM", "list": [{"id": 2}]}]}}
        get_json.side_effect = [empty, empty, empty, empty, found]
        adapter = Flo()
        with patch.object(adapter, "lookup", return_value=ALBUM):
            self.assertEqual(adapter.search({**ALBUM, "artist": "First, Second"}, "KR"), [ALBUM])
        self.assertIn("keyword=Second+Blue", get_json.call_args.args[0])

    def test_lastfm_album_urls_and_unicode_roundtrip(self):
        examples = [
            ("https://www.last.fm/music/Daft+Punk/Discovery", "Daft+Punk/Discovery"),
            ("https://www.last.fm/ko/music/Bj%C3%B6rk/Debut", "Bj%C3%B6rk/Debut"),
        ]
        for url, identifier in examples:
            self.assertEqual(identify(url), ("lastfm", identifier))
            self.assertEqual(identify(canonical("lastfm", identifier)), ("lastfm", identifier))
        with self.assertRaises(ValueError):
            identify("https://www.last.fm/music/Artist/_/Track")

    @patch.dict("os.environ", {"LASTFM_API_KEY": ""})
    def test_lastfm_missing_key_is_explicit(self):
        with self.assertRaises(ProviderError) as caught:
            Lastfm().search(ALBUM, "KR")
        self.assertEqual(caught.exception.status, "credentials_required")

    @patch.dict("os.environ", {"LASTFM_API_KEY": "test-only-key"})
    @patch("smartlinks.providers.get_json")
    def test_lastfm_search_handles_single_result_and_encodes_parameters(self, get_json):
        get_json.return_value = {"results": {"opensearch:totalResults": "1", "albummatches": {"album": {"name": "Blue & Gold", "artist": "Artist", "url": "https://untrusted.test/ignore", "image": [{"size": "small", "#text": "https://example.com/small"}, {"size": "extralarge", "#text": "https://example.com/large"}]}}}}
        found = Lastfm().search({**ALBUM, "title": "Blue & Gold"}, "KR")
        self.assertEqual(len(found), 1)
        self.assertIn("album=Blue+%26+Gold", get_json.call_args.args[0])
        self.assertEqual(found[0]["url"], "https://www.last.fm/music/Artist/Blue+%26+Gold")
        self.assertEqual(found[0]["cover"], "https://example.com/large")
        self.assertIsNone(found[0]["track_count"])
        self.assertEqual(score({**ALBUM, "title": "Blue & Gold"}, found[0])[2], "review")

    @patch.dict("os.environ", {"LASTFM_API_KEY": "test-only-key"})
    @patch("smartlinks.providers.get_json")
    def test_lastfm_lookup_tracks_does_not_treat_wiki_date_as_release(self, get_json):
        get_json.return_value = {"album": {"name": "Blue", "artist": "Artist", "mbid": "musicbrainz-id", "wiki": {"published": "22 Oct 2026"}, "tracks": {"track": {"name": "Song", "duration": "123"}}}}
        result = Lastfm().lookup("Artist/Blue", "KR")
        self.assertEqual(result["track_count"], 1)
        self.assertEqual(result["tracks"][0]["duration_ms"], 123000)
        self.assertEqual(result["release_date"], "")
        self.assertEqual(result["mbid"], "musicbrainz-id")
        get_json.return_value = {"error": 29, "message": "Rate limit exceeded"}
        with self.assertRaises(ProviderError) as caught:
            Lastfm().lookup("Artist/Blue", "KR")
        self.assertEqual(caught.exception.status, "rate_limited")


class LegacyFloResponseTests(SimpleTestCase):
    def test_existing_numeric_links_are_normalized_in_public_and_draft_responses(self):
        from .models import SmartLink
        from .serializers import ResolutionSerializer, SmartLinkSerializer
        old = {**ALBUM, "platform": "flo", "url": "https://www.music-flo.com/detail/album/8003203/albumtrack"}
        result = {"album": old, "platforms": [{"key": "flo", "candidates": [{**old, "id": CANDIDATE_ID}]}]}
        draft = Resolution(source_url=old["url"], status="ready", result=result)
        data = ResolutionSerializer(draft).data
        expected = canonical("flo", "8003203")
        self.assertEqual(data["result"]["album"]["url"], expected)
        self.assertEqual(data["result"]["platforms"][0]["candidates"][0]["url"], expected)
        public = SmartLink(album=old, links=[{"platform": "flo", "url": old["url"]}], resolution=draft)
        public_data = SmartLinkSerializer(public).data
        self.assertEqual(public_data["links"][0]["url"], expected)
        self.assertEqual(public_data["album"]["url"], expected)
        self.assertEqual(draft.result["album"]["url"], old["url"])


@override_settings(DISABLED_PROVIDERS={"spotify"})
class DisabledProviderTests(APITestCase):
    @patch("smartlinks.services.ADAPTERS")
    def test_disabled_provider_is_never_looked_up_or_searched(self, adapters):
        class Source:
            def lookup(self, identifier, country):
                return deepcopy(ALBUM)
        adapters.get.return_value = Source()
        adapters.__contains__.return_value = False
        result = resolve(ALBUM["url"], "KR")
        spotify = next(item for item in result["platforms"] if item["key"] == "spotify")
        self.assertEqual(spotify["status"], "disabled")
        adapters.__getitem__.assert_not_called()
        adapters.get.reset_mock()
        with self.assertRaises(ProviderError):
            resolve("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "KR")
        adapters.get.assert_not_called()

    def test_disabled_source_is_rejected_before_queueing(self):
        response = self.client.post("/api/resolutions/", {"url": "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("제외", str(response.data))
        platforms = self.client.get("/api/resolutions/platforms/").data
        self.assertEqual(next(p for p in platforms if p["key"] == "spotify")["mode"], "disabled")


class LiveMatchingRegressionTests(SimpleTestCase):
    def test_same_title_different_artist_and_near_spelling_are_rejected(self):
        source = {**ALBUM, "title": "Discovery", "artist": "Daft Punk", "upc": ""}
        for artist in ("AK", "Electric Light Orchestra", "Data Punk"):
            with self.subTest(artist=artist):
                self.assertEqual(score(source, {**source, "artist": artist})[0], 0)

    def test_explicit_bilingual_artist_aliases_match_but_still_need_review(self):
        source = {**ALBUM, "title": "Palette", "artist": "아이유 (IU)", "upc": ""}
        for artist in ("IU", "아이유", "아이유 (IU)"):
            value, evidence, status = score(source, {**source, "artist": artist})
            self.assertGreaterEqual(value, 90)
            self.assertEqual(status, "review")
        self.assertEqual(score(source, {**source, "artist": "eill"})[0], 0)

    @patch("smartlinks.providers.get_json")
    def test_deezer_search_uses_field_filters_and_deduplicates_track_album_ids(self, get_json):
        empty = {"data": []}
        found = {"data": [{"album": {"id": 7}}, {"album": {"id": 7}}]}
        get_json.side_effect = [empty, empty, found]
        adapter = Deezer()
        with patch.object(adapter, "lookup", return_value={**ALBUM, "artist": "IU"}) as lookup:
            self.assertEqual(len(adapter.search({**ALBUM, "artist": "아이유 (IU)"}, "KR")), 1)
        url = get_json.call_args.args[0]
        self.assertIn("api.deezer.com/search?", url)
        self.assertIn("artist%3A%22IU%22", url)
        self.assertIn("album%3A%22Blue%22", url)
        lookup.assert_called_once_with("7", "KR")
