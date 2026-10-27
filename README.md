# GIMOON Smart Links

앨범 URL 하나로 국내외 음원 플랫폼에서 동일 앨범을 검색하고, 확인한 링크를 하나의 공개 페이지로 발행하는 프로젝트입니다.

## 기술 구성

- Next.js App Router · React · JavaScript · Tailwind CSS v4
- Django 5.2 · Django REST Framework · PostgreSQL
- 독립 worker: PostgreSQL에 저장한 작업을 가져와 플랫폼별 조회를 병렬 처리
- Prettier: JavaScript, JSON, YAML, Markdown 정렬 (Python 제외)

## 현재 지원 범위

12개 플랫폼의 앨범 주소를 인식하며, **모든 플랫폼의 자동 조회가 완료된 상태는 아닙니다.** 실제 응답 검증일: 2026-10-27.

| 플랫폼        | 원본 조회 / 다른 플랫폼에서 검색 | 상태                                                                                                          |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Apple Music   | iTunes 공개 카탈로그 API         | 원본 앨범 조회는 가능. 다른 플랫폼 앨범 검색에서 제외                                                         |
| Deezer        | 공개 앨범·검색 API               | 원본 앨범 조회는 가능. 검색 누락이 있어 다른 플랫폼 앨범 검색에서 제외                                        |
| Spotify       | 자동 조회·검색 제외              | 현재 `DISABLED_PROVIDERS=spotify`. 토큰 발급은 확인했으나 앱 소유 계정 Premium 조건으로 검색 API가 403을 반환 |
| FLO           | 공개 웹 카탈로그 JSON            | Daft Punk · Discovery 검색·상세 응답 검증. 공식 제휴 API 계약이 아닌 실험적 연결                              |
| Last.fm       | 공식 앨범 검색·상세 API          | `.env`에 API 키 설정됨. 앨범 검색·상세 API 연결 확인                                                          |
| 멜론          | 공개 HTML 파서·앨범 검색         | `melon_crolling.py`와 같은 통합 검색 경로로 Discovery 앨범 ID·상세 메타데이터·14곡 응답 확인                  |
| 지니          | 공개 HTML 파서·앨범 검색         | 검색·상세 페이지 응답 확인. 현재 HTML에서 아티스트 링크 파싱 보완                                             |
| 벅스          | 공개 HTML 파서·앨범 검색         | Discovery 검색에서 앨범 후보 두 개 응답 확인. 후보가 중복 발매본인지 검토 필요                                |
| YouTube Music | 비공식 `ytmusicapi`              | 앨범 검색·상세 어댑터 추가. YouTube Music 웹 인터페이스 변경에 영향을 받음                                    |
| SoundCloud    | 공식 API                         | Artist Pro 앱 자격 증명 필요. 다른 플랫폼 앨범 검색에서 제외                                                  |
| TIDAL         | 공식 Catalog API                 | 현재 사용자 지역에서 개발자 가입 불가. 다른 플랫폼 앨범 검색에서 제외                                         |
| Amazon Music  | 공개 페이지 크롤러               | 검색 페이지에서 앨범 링크를 찾지 못해 다른 플랫폼 앨범 검색에서 제외                                          |

국내 HTML 크롤러는 Melon·Genie·Bugs의 공개 페이지에서 앨범 정보를 조회합니다. 각 플랫폼의 페이지 구조·응답 정책 변경에 따라 실패할 수 있습니다. 직접 추가한 링크는 자동 검증된 결과로 취급하지 않습니다. 단축 링크는 지원하지 않으며, 음원 파일을 다운로드하지 않습니다.

## 로컬 실행

Node.js 22 LTS와 Docker Compose v2가 필요합니다.

```sh
cp .env.example .env
```

`.env`에서 `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`를 변경합니다. 이미 생성된 `.env`가 있다면 덮어쓰지 않습니다.

```sh
npm install
docker compose build
docker compose up -d db backend
docker compose exec backend python manage.py migrate
docker compose up -d worker frontend
```

- 사이트: http://localhost:3000
- API: http://localhost:8000/api/
- 관리자: http://localhost:8000/admin/

Compose 설정은 로컬 개발용입니다. 프런트엔드와 Django 소스는 호스트 폴더를 컨테이너에 연결해 저장 즉시 반영하고, worker는 Python 파일 변경 시 자동 재시작합니다. Node/Python 의존성을 바꾼 경우 이미지를 다시 빌드합니다 (`docker compose up -d --build`). 웹 포트는 로컬 컴퓨터에서만 접근할 수 있습니다. 운영 배포에는 HTTPS 프록시, 보안 쿠키, 운영용 앱 서버 설정이 별도로 필요합니다.

관리자 계정은 필요할 때 `docker compose exec backend python manage.py createsuperuser`로 생성합니다. 기존 아티스트 프로필 API는 유지하며, 첫 화면은 스마트 링크 생성기로 변경했습니다.

## 계정 및 로그인

`/login`에서 이메일·비밀번호로 가입하거나 로그인할 수 있습니다. 비밀번호는 8~16자이며, 로그아웃하지 않아도 브라우저 세션으로 유지됩니다. Google 로그인을 활성화하려면 Google Cloud Console에서 OAuth 클라이언트 유형을 웹 애플리케이션으로 만들고, 승인된 리디렉션 URI에 `http://localhost:8000/api/auth/google/callback/`을 등록합니다. 발급한 Client ID와 Secret을 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣고 backend를 재생성합니다. 배포 주소에서는 `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `CSRF_TRUSTED_ORIGINS`를 해당 HTTPS 도메인으로 바꿉니다. OAuth는 서버 측 인증 코드 흐름과 state 검증을 사용하며 Google 이메일이 확인된 계정만 연결합니다. [Google 공식 OAuth 웹 서버 안내](https://developers.google.com/identity/protocols/oauth2/web-server)

계정의 최초 가입 경로(`email`, `google`, `legacy`)와 연결된 로그인 수단은 `AccountProfile`에 기록하며 Django Admin 사용자 목록과 상세 화면에서 확인할 수 있습니다. 이메일 계정에 Google 로그인을 연결해도 최초 가입 경로는 바뀌지 않고 연결된 수단에 Google이 추가됩니다.

로그인 상태에서 만든 스마트 링크는 계정에 소유권이 저장되어 다른 기기에서도 `/library`에 나타납니다. 이전 브라우저에 편집 토큰이 저장된 익명 링크는 로그인 시 계정으로 가져옵니다.

현재 Apple 연결은 별도 개발자 토큰 없이 쓸 수 있는 공개 iTunes Search/Lookup API입니다. 이는 Apple Music 전체 카탈로그 API와 다릅니다. Apple Music API는 유료 Apple Developer Program 멤버십과 개발자 토큰이 필요하므로, 현재 기본 경로에서는 사용하지 않습니다. 국가별 카탈로그 차이로 검색 결과가 없을 수 있습니다.

현재 `.env`의 `DISABLED_PROVIDERS=spotify` 설정으로 Spotify의 원본 조회·자동 검색을 제외합니다. 수동 링크 등록은 유지합니다.

Spotify를 다시 연결하려면 `DISABLED_PROVIDERS`에서 `spotify`를 제거하고, `.env`에 `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`을 설정하고 backend와 worker를 재생성합니다. 키가 없어도 다른 플랫폼 조회는 계속됩니다.

Last.fm은 `.env`에 `LASTFM_API_KEY`를 설정하면 `album.search`와 `album.getInfo`로 앨범 검색·원본 조회를 지원합니다. 키가 없는 환경은 연결 상태에서 키 설정 필요로 표시합니다. Last.fm은 스트리밍 서비스가 아니므로 공개 페이지에 ‘앨범 정보’ 버튼으로 표시합니다.

YouTube Music은 비공식 `ytmusicapi` 라이브러리를 사용하므로 플랫폼 내부 웹 인터페이스 변경 시 작동이 중단될 수 있습니다. SoundCloud는 Artist Pro가 있어야 API 앱 자격 증명을 발급할 수 있고, 공개 페이지 크롤링은 robots.txt에서 차단됩니다. TIDAL은 API 앱 자격 증명이 없는 환경에서 수동 링크만 지원하며 개발자 약관이 스크래핑을 금지합니다. VIBE는 네이버 공식 안내에 따라 2026년 12월 31일 서비스 종료 예정이므로 신규 플랫폼 검색과 URL 등록 지원에서 제거했습니다. 이전에 발행한 VIBE 링크는 기존 공개 페이지에서 계속 표시됩니다. Amazon 검색 페이지에서는 앨범 링크를 찾지 못했습니다.

FLO는 통합 검색(`search/integration`)을 먼저 사용하고 결과가 없으면 앨범 검색으로 보완합니다. 숫자 ID와 문자 ID 주소를 모두 입력할 수 있으며, 공개 링크는 `0123456789 → danielzohy` 변환을 적용합니다. 기존에 저장한 숫자형 FLO 링크도 API 응답에서 변환해 제공합니다.

## 사용 흐름

1. `/login`에서 가입하거나 로그인합니다. 로그아웃 상태에서는 링크 생성·수정·삭제와 라이브러리를 사용할 수 없습니다.
2. 지원하는 플랫폼의 HTTPS 앨범 상세 URL과 검색 국가를 입력합니다.
3. API는 검색 작업과 편집 토큰을 반환합니다. worker가 원본 정보를 가져오고 다른 플랫폼을 검색합니다.
4. 원본 앨범과 UPC가 일치하는 후보만 기본 선택합니다. 그 외 후보는 사용자가 확인하고 선택합니다.
5. 같은 플랫폼에서는 앨범 하나만 선택합니다. 찾지 못한 플랫폼은 앨범 주소를 한 줄씩 추가할 수 있습니다.
6. 선택을 확인한 후 발행하면 `/s/{slug}` 공개 페이지가 생성됩니다. 공유된 공개 페이지는 로그인 없이 열 수 있습니다.

편집 토큰은 익명 링크의 소유권 확인에 7일간 유효합니다. 로그인 상태에서 생성한 링크는 계정 소유권으로 관리됩니다.

## 매칭 기준

UPC가 양쪽에 있으면 우선 비교합니다. UPC가 다르면 후보에서 제외합니다. 앨범명 유사도와 발매일·트랙 수도 비교하며, 아티스트는 정규화한 이름 또는 메타데이터에 명시된 한글·영문 별칭이 일치해야 후보로 남깁니다. `Daft Punk`와 `Data Punk`처럼 철자가 비슷한 다른 가수는 제외합니다. Deluxe·Live·Remaster 등 에디션이나 트랙 수가 다르면 수동 확인 대상으로 둡니다. 점수는 설명을 위한 규칙 기반 점수이며 정확도 확률이 아닙니다. 국가별 카탈로그 차이와 아티스트 한글·영문 별칭으로 인해 누락될 수 있습니다.

예를 들어 `아이유 (IU)`는 `아이유`와 `IU`를 모두 비교하되, 외부 사전 없이 다른 별칭을 추측하지 않습니다.

트랙 목록은 가능한 제공처에서 수집하지만, ISRC 기반 교차 검색, 전체 트랙 페이지 순회, 아티스트 별칭 사전은 아직 구현하지 않았습니다. 원본 제공처의 artwork를 변형하지 않고 출처 앨범 링크와 함께 표시합니다.

## DRF API

| 메서드 | 경로                             | 기능                                                                    |
| ------ | -------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/api/resolutions/`              | `{ "url": "https://...", "country": "KR" }`로 작업 생성, 편집 토큰 반환 |
| GET    | `/api/resolutions/{id}/`         | `X-Edit-Token` 헤더로 상태·후보 확인                                    |
| GET    | `/api/resolutions/platforms/`    | 플랫폼별 연결 모드 목록                                                 |
| POST   | `/api/resolutions/{id}/publish/` | 편집 토큰과 `{ "candidate_ids": [], "manual_urls": [] }`로 발행         |
| GET    | `/api/smartlinks/{slug}/`        | 공개 앨범·플랫폼 링크 조회                                              |
| GET    | `/api/smartlinks/mine/`          | 로그인 계정 또는 편집 토큰이 소유한 링크 목록                           |
| PUT    | `/api/smartlinks/{slug}/edit/`   | 소유자만 링크 구성 수정                                                 |
| DELETE | `/api/smartlinks/{slug}/`        | 소유자만 스마트 링크 삭제                                               |
| POST   | `/api/auth/register/`            | 이메일 계정 가입 (비밀번호 최대 16자)                                   |
| POST   | `/api/auth/login/`               | 이메일 로그인                                                           |
| GET    | `/api/auth/google/start/`        | Google OAuth 시작                                                       |

검색 작업 생성·조회·발행, 라이브러리·수정·삭제 API는 로그인 세션이 필요합니다. 공개 스마트 링크 상세 조회와 인증 시작·로그인·가입 엔드포인트는 공개입니다.

공개 페이지 목록은 제공하지 않습니다. 편집 토큰은 공개 응답에 포함하지 않습니다. 작업 생성은 IP당 시간당 10회, 상태 조회와 발행은 분당 120회 제한합니다. 현재 캐시는 프로세스 로컬이므로 이 제한은 다중 프로세스·서버 전체에 걸쳐 엄격히 집계되지 않습니다. 운영 전 공유 캐시·사용자 인증·일일 제공처별 호출 예산이 필요합니다.

외부 요청은 고정된 호스트·경로와 검증된 앨범 식별자로 구성합니다. 리디렉션을 따라가지 않으며, 연결·응답 시간과 최대 응답 크기를 제한합니다. 원본 링크는 정해진 플랫폼만 허용하고, 수동 URL은 서버에서 요청하지 않습니다.

## 개발·검증

```sh
npm run format
npm run format:check
docker compose exec frontend npm run build
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test
docker compose exec backend python manage.py makemigrations --check --dry-run
```

Compose 개발 서버를 사용할 때는 컨테이너의 Next.js가 포트 3000을 점유합니다. 프런트엔드만 호스트에서 실행하려면 먼저 `docker compose stop frontend`를 실행한 뒤 `npm run dev`를 시작합니다. 호스트 Next.js는 `/api/*`를 기본 `http://localhost:8000/api/*`로 프록시하며 `frontend/.env.local`의 `API_INTERNAL_URL`로 변경할 수 있습니다.

Compose의 Next.js 서버는 개발용입니다. 운영 배포 전 HTTPS, 비밀값, 공유 캐시, 정적 파일 서빙과 제공처별 사용 권한을 구성해야 합니다. 부하가 커지면 현재 PostgreSQL 작업 큐를 Celery 등 별도 큐 시스템으로 확장할 수 있습니다.

## 참고 구현

사용자가 제공한 `sound-link/sound_link_backend/apps/soundlink/croll/flo_crolling.py`와 `lastfm_crolling.py`를 참고했습니다. FLO ID 변환·통합 검색·복수 아티스트 재검색과 Last.fm 앨범 API 접근 방식을 반영했습니다. 첫 결과를 무조건 같은 앨범으로 확정하지 않고 기존 후보 검토 절차를 유지합니다. 원본 참고 프로젝트는 수정하지 않았습니다.

## 참고한 공식 문서

- [Spotify 앨범 API](https://developer.spotify.com/documentation/web-api/reference/get-an-album)
- [Spotify 검색 API](https://developer.spotify.com/documentation/web-api/reference/search)
- [Apple iTunes Search API](https://performance-partners.apple.com/search-api)
- [Apple Music API](https://developer.apple.com/documentation/applemusicapi/)
- [Deezer 개발자 포털](https://developers.deezer.com/api)
- [Last.fm album.search](https://www.last.fm/api/show/album.search)
- [Last.fm album.getInfo](https://www.last.fm/api/show/album.getInfo)

## 프런트엔드 파일 구조

프런트엔드는 TypeScript 없이 `.js` 파일로 작성합니다.

- `frontend/src/app/page.js`: 스마트 링크 생성 화면
- `frontend/src/hooks/useSmartLink.js`: 검색, 상태 조회, 발행 로직
- `frontend/src/components/`: 아이콘, 플랫폼 표시, 앨범 미리보기
- `frontend/src/app/s/[slug]/page.js`: 발행된 공개 페이지
- `frontend/src/app/globals.css`: 공통 스타일
- `frontend/jsconfig.json`: `@/` 경로 설정
- `frontend/next.config.js`: API 프록시 설정
