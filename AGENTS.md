# 프로젝트 작업 규칙

- 프런트엔드는 Next.js App Router, React, JavaScript를 사용한다.
- 프런트엔드 소스는 `.js`로 작성하며 TypeScript를 도입하지 않는다.
- UI 스타일은 Tailwind CSS로 작성한다.
- JavaScript, JSON, YAML, Markdown은 Prettier로 정렬한다.
- 백엔드는 Django와 Django REST Framework를 사용한다.
- API는 models, serializers, permissions, ViewSet, router로 역할을 분리한다.
- 기본 데이터베이스는 PostgreSQL이다.
- 비밀값은 환경 변수로 주입하고 `.env`를 커밋하지 않는다.
- 사용자 소유 리소스의 수정 권한과 공개되지 않은 데이터의 접근 권한을 검증한다.

## 제품 방향

- 핵심 제품은 앨범 URL을 입력해 여러 음원 플랫폼의 동일 앨범 링크를 모으는 스마트 링크 서비스다.
- 국내외 플랫폼을 확장 가능한 어댑터로 분리한다.
- 자동 검색 후보, 수동 확인, 직접 등록과 미구현·인증 필요·접근 제한 상태를 구분한다.
- 검색 결과를 검증 없이 같은 앨범으로 단정하지 않는다.
