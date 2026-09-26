"""
LLM token-budget behaviour: short evidence aliases, trimmed evidence,
compact prompts, and the answer cache. The LLM itself is stubbed, so no
OPENAI_API_KEY is needed.
"""
from __future__ import annotations

import json

import pytest

from app.core.config import get_settings
from app.llm import cache as llm_cache
from app.llm.prompts import build_user_prompt
from app.llm.schemas import EvidenceChunk, FarmerProfile, SourceType


def _chunk(i: int, text: str = "PM-KISAN gives Rs 6000 per year to small farmer families.") -> EvidenceChunk:
    return EvidenceChunk(
        chunk_id=f"chunk_{i:012x}", document_id=f"doc{i}", source_type=SourceType.VIKASPEDIA,
        title="PM-KISAN", section="Benefits", source_url="https://vikaspedia.in/pm-kisan", text=text,
    )


@pytest.fixture(autouse=True)
def _fresh_cache():
    llm_cache.clear()
    yield
    llm_cache.clear()


def test_prompt_omits_urls_and_empty_profile_fields():
    prompt = build_user_prompt("pm kisan?", [_chunk(1)], profile=FarmerProfile(state="Kerala"))
    assert "https://" not in prompt
    assert '"state":"Kerala"' in prompt
    assert "null" not in prompt


def test_compact_evidence_caps_count_length_and_aliases_ids():
    from app.llm.answer_generator import _compact_evidence

    settings = get_settings()
    chunks = [_chunk(i, "word " * 500) for i in range(settings.llm_max_evidence_chunks + 3)]
    compacted, alias_to_id = _compact_evidence(chunks)

    assert len(compacted) == settings.llm_max_evidence_chunks
    assert [c.chunk_id for c in compacted] == [f"E{i}" for i in range(1, len(compacted) + 1)]
    assert alias_to_id["E1"] == chunks[0].chunk_id
    assert all(len(c.text) <= settings.llm_max_chars_per_chunk + 1 for c in compacted)
    # Originals are untouched: the UI evidence panel and the guard see full text and real ids.
    assert chunks[0].chunk_id.startswith("chunk_") and len(chunks[0].text) > 2000


def test_resolve_aliases_maps_back_and_leaves_unknown_ids_for_the_guard():
    from app.llm.answer_generator import _resolve_aliases
    from app.llm.schemas import Claim, LLMAnswer, SchemeMatch

    answer = LLMAnswer(
        answer="x", relevant=True, confidence="high",
        claims=[Claim(claim="c", supported_by=["E1", "[E2]", "E9"])],
        schemes=[SchemeMatch(scheme_name="PM-KISAN", match_strength="strong", why_it_matches="w", citations=["E2"])],
        citations=["E1"],
    )
    resolved = _resolve_aliases(answer, {"E1": "chunk_a", "E2": "chunk_b"})
    assert resolved.claims[0].supported_by == ["chunk_a", "chunk_b", "E9"]
    assert resolved.schemes[0].citations == ["chunk_b"]
    assert resolved.citations == ["chunk_a"]


def test_cache_key_ignores_case_and_whitespace():
    assert llm_cache.make_key("m", "What is  PM-KISAN?") == llm_cache.make_key("m", "what is pm-kisan?")
    assert llm_cache.make_key("m", "a") != llm_cache.make_key("m", "b")


def test_cache_evicts_least_recently_used(monkeypatch):
    monkeypatch.setenv("LLM_CACHE_MAX_ENTRIES", "2")
    get_settings.cache_clear()
    try:
        llm_cache.put("a", "1")
        llm_cache.put("b", "2")
        llm_cache.get("a")  # touch a, so b is the LRU entry
        llm_cache.put("c", "3")
        assert llm_cache.get("a") == "1"
        assert llm_cache.get("b") is None
        assert llm_cache.get("c") == "3"
    finally:
        get_settings.cache_clear()


@pytest.mark.usefixtures("isolated_kb")
def test_repeat_question_hits_cache_and_citations_resolve_to_real_ids(monkeypatch):
    from app.ingestion.pipeline import ingest_documents
    from app.llm import answer_generator, openai_client
    from app.rag.metadata import RawDocument

    ingest_documents([
        RawDocument(
            document_id="doc1", title="PM-KISAN",
            content="PM-KISAN provides income support of Rs 6000 per year to small and marginal farmer families.",
            source_type="vikaspedia", source_url="https://vikaspedia.in/agriculture/pm-kisan",
            section="Benefits", category="policies-and-schemes",
        ),
    ])

    calls: list[str] = []

    def fake_llm(system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        calls.append(user_prompt)
        return json.dumps({
            "answer": "PM-KISAN provides income support of Rs 6000 per year.",
            "relevant": True, "confidence": "high",
            "claims": [{"claim": "PM-KISAN provides income support of Rs 6000 per year to small and marginal farmer families.",
                        "supported_by": ["E1"]}],
            "schemes": [], "missing_information": [], "objections_addressed": [], "citations": ["E1"],
        })

    monkeypatch.setattr(openai_client, "is_available", lambda: True)
    monkeypatch.setattr(openai_client, "chat_completion_json", fake_llm)

    first = answer_generator.generate_answer("What does PM-KISAN give farmers?")
    second = answer_generator.generate_answer("what does PM-KISAN give farmers?  ")

    assert len(calls) == 1, "second identical question must be served from cache"
    assert "[E1]" in calls[0] and "chunk_" not in calls[0]
    assert first.refused is False and second.answer == first.answer
    assert first.trust_check.claims_removed == 0  # E1 resolved to the real chunk_id, so the claim survived the guard
