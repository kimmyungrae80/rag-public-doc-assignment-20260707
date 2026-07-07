# 과제 제출 정보

## 제출 Repository

링크: https://github.com/kimmyungrae80/rag-public-doc-assignment-20260707

## 접속 계정

별도 접속 계정 없음. 로컬 실행형 프로젝트입니다.

```bash
npm run chunk
npm run demo
npm start
```

웹 UI 기본 주소: http://127.0.0.1:3000

## 파이프라인명

재난대응 AI 활용 현장교육 문서 검색

## 활용 문서

2026년 재난대응 AI 활용 현장교육 운영계획(안)

## RAG 평가결과

평가 결과 문서: `docs/rag_evaluation.md`

## 구현 요약

- 청킹: 제목/조항 계층을 보존하는 문단 기반 의미 청킹
- Vector DB: Supabase pgvector SQL 및 RPC 함수 제공
- Chat Model: OpenRouter Chat Completions API 연동
- Re-Rank: Cohere rerank 또는 Jina reranker 연동, API 키 없을 때 local fallback 제공
- RAG 방식: Naive RAG와 Advanced RAG 모두 구현

## 제출 시 복사용 문구

```text
링크: https://github.com/kimmyungrae80/rag-public-doc-assignment-20260707
접속 계정: 별도 없음
파이프라인명: 재난대응 AI 활용 현장교육 문서 검색
RAG 평가결과: Repository 내 docs/rag_evaluation.md 참고
```
