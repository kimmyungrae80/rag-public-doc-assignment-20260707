# RAG 기반 문서 검색·답변 시스템

공공기관 문서 양식과 유사한 10장 이내 문서를 대상으로 구현한 RAG 과제 제출용 프로젝트입니다. Supabase pgvector에 문서를 적재하고, OpenRouter Chat Model로 답변을 생성하며, Naive RAG와 Advanced RAG를 모두 지원합니다.

## 제출 요건 대응

| 구분 | 구현 내용 |
| --- | --- |
| 문서 | `docs/agency_emergency_report.md` - 공공기관 재난대응 교육 운영계획 문서 |
| 청킹 | 제목/조항 계층을 보존하는 문단 기반 의미 청킹 + overlap |
| Vector DB | Supabase pgvector 테이블, RPC 함수 제공 |
| Chat Model | OpenRouter Chat Completions API |
| Re-Rank | Cohere 또는 Jina rerank API, 키 없을 때 local fallback |
| RAG 방식 | Naive RAG, Advanced RAG 모두 구현 |

## 프로젝트 구조

```text
.
├── docs/agency_emergency_report.md       # 과제용 문서
├── sql/001_supabase_schema.sql           # Supabase 테이블/RPC 생성 SQL
├── src/                                  # RAG, 청킹, API 연동 코드
├── scripts/chunk.mjs                     # 문서 청킹
├── scripts/seed-supabase.mjs             # Supabase 적재
├── scripts/ask.mjs                       # CLI 질의응답
├── scripts/server.mjs                    # 웹 질의응답 서버
└── public/index.html                     # 간단한 웹 UI
```

## 실행 순서

1. 환경 파일 생성

```bash
cp .env.example .env
```

이 프로젝트는 별도 패키지 없이 `.env`를 자동으로 읽습니다.

2. Supabase SQL 실행

Supabase 대시보드의 SQL Editor에서 `sql/001_supabase_schema.sql` 내용을 실행합니다. 테이블명과 함수명은 과제 중복을 피하기 위해 `rag_assignment_*_20260707` 형식으로 만들었습니다.

3. `.env`에 API 키 입력

필수:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=...
```

권장:

```bash
JINA_API_KEY=...
COHERE_API_KEY=...
```

4. 문서 청킹

```bash
npm run chunk
```

5. Supabase 적재

```bash
npm run seed
```

6. 질문 실행

```bash
npm run ask -- "비상연락망 점검 주기는?"
npm run ask:naive -- "교육 대상은 누구야?"
npm run ask:advanced -- "개인정보 처리 기준과 보안 유의사항을 알려줘"
```

7. 웹 UI 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

기본 서버 주소는 `127.0.0.1:3000`입니다. 포트를 바꾸려면 `.env` 또는 실행 환경에서 `PORT=3001`처럼 지정합니다.

## API 키 없이 구조 검증

API 키가 아직 없으면 아래 명령으로 로컬 fallback 동작을 확인할 수 있습니다.

```bash
npm run demo
```

이 모드는 Supabase/OpenRouter를 호출하지 않고 청킹, 검색, 재랭킹 흐름만 검증합니다. 실제 제출 시에는 `.env`에 Supabase, OpenRouter, rerank API 키를 넣고 `npm run seed` 후 실행하면 됩니다.

## Naive RAG와 Advanced RAG 차이

Naive RAG:

- 사용자 질문을 그대로 임베딩합니다.
- Supabase vector similarity 검색으로 상위 청크를 가져옵니다.
- 검색된 청크를 바로 OpenRouter 모델에 전달합니다.

Advanced RAG:

- 질문을 검색 친화적인 독립 질의로 재작성합니다.
- vector 검색과 keyword 검색을 결합한 hybrid RPC를 사용합니다.
- 후보 청크를 rerank 모델로 재정렬합니다.
- 상위 근거만 답변 모델에 전달하여 답변 정확도를 높입니다.

## 예시 질문

```text
비상연락망 점검 주기는?
교육 대상과 운영 방식은 어떻게 되나요?
개인정보가 들어간 훈련 자료는 어떻게 처리해야 하나요?
사후 평가는 어떤 지표로 하나요?
재난 대응 훈련에서 AI를 어떻게 활용하나요?
```
