import re
import unicodedata
from difflib import SequenceMatcher


def normalized(value):
    return re.sub(r"[^\w]", "", unicodedata.normalize("NFKC", value).casefold())


def artist_aliases(name):
    """Compare credited collaborators and explicit bilingual name variants."""
    aliases = []
    collaborators = re.split(r"\s*(?:,|&|×|\bx\b|feat\.?|ft\.?|featuring|with)\s*", name, flags=re.I)
    for collaborator in collaborators:
        collaborator = collaborator.strip()
        if not collaborator:
            continue
        aliases.append(collaborator)
        match = re.fullmatch(r"\s*(.+?)\s*[（(]([^()（）]+)[）)]\s*", collaborator)
        if match:
            primary, alternate = (part.strip() for part in match.groups())
            bilingual = (re.search(r"[가-힣]", primary) and re.search(r"[A-Za-z]", alternate)) or (re.search(r"[A-Za-z]", primary) and re.search(r"[가-힣]", alternate))
            if bilingual:
                aliases.extend([primary, alternate])
    return list(dict.fromkeys(aliases or [name]))


def artists_match(first, second):
    return bool({normalized(name) for name in artist_aliases(first)} & {normalized(name) for name in artist_aliases(second)})


def score(source, candidate):
    """Evidence score, not a probability. Edition conflicts always require review."""
    reasons = []
    upc_a = str(source.get("upc", "")).lstrip("0")
    upc_b = str(candidate.get("upc", "")).lstrip("0")
    if upc_a and upc_b and upc_a != upc_b:
        return 0, ["UPC 불일치"], "review"
    editions = ("deluxe", "remaster", "live", "instrumental", "karaoke", "sped up", "slowed")
    conflict = any((word in source["title"].casefold()) != (word in candidate["title"].casefold()) for word in editions)
    title = SequenceMatcher(None, normalized(source["title"]), normalized(candidate["title"])).ratio()
    artist_matches = artists_match(source["artist"], candidate["artist"])
    same_upc = bool(upc_a and upc_b and upc_a == upc_b)
    if not artist_matches and not same_upc:
        return 0, ["아티스트 이름 또는 명시된 별칭 불일치"], "review"
    if title < 0.6 and not same_upc:
        return 0, ["앨범명 불일치"], "review"
    artist = 1 if artist_matches else 0
    value = round(50 * title + 40 * artist)
    if title == 1:
        reasons.append("앨범명 일치")
    if artist == 1:
        reasons.append("아티스트 일치" if normalized(source["artist"]) == normalized(candidate["artist"]) else "아티스트 별칭 일치")
    count_a, count_b = source.get("track_count"), candidate.get("track_count")
    if count_a and count_b:
        if count_a == count_b:
            value += 5
            reasons.append("트랙 수 일치")
        else:
            conflict = True
            reasons.append("트랙 수 다름")
    if source.get("release_date") and source.get("release_date") == candidate.get("release_date"):
        value += 5
        reasons.append("발매일 일치")
    if upc_a and upc_b and upc_a == upc_b:
        value = 100
        reasons.append("UPC 일치")
    if conflict:
        reasons.append("다른 에디션일 수 있음")
    # Even strong textual matches need explicit review. Only an identical UPC is verified.
    verified = value == 100 and bool(upc_a and upc_b) and not conflict
    return min(value, 100), reasons or ["텍스트 유사도 비교"], "matched" if verified else "review"
