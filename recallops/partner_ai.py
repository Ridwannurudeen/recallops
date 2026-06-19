from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from typing import Any


AIML_BASE_URL = "https://api.aimlapi.com/v1"
FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
DEFAULT_AIML_MODEL = "gpt-4o-mini"
DEFAULT_FEATHERLESS_MODEL = "Qwen/Qwen2.5-7B-Instruct"


def partner_ai_status() -> dict[str, object]:
    return _partner_summary(_provider_result("ai_ml_api"), _provider_result("featherless"))


def run_partner_ai(
    *,
    complaint_text: str,
    shipment_csv: str,
    recovered_shipment_csv: str,
) -> dict[str, object]:
    featherless = _run_provider(
        provider="featherless",
        system_prompt=(
            "You are the RecallOps Evidence Agent. Extract only facts supported by the "
            "complaint source text. Return compact JSON with keys product, lot, severity, "
            "complaint_count, and evidence_summary."
        ),
        user_prompt=f"Complaint source text:\n{complaint_text.strip()}",
    )
    ai_ml_api = _run_provider(
        provider="ai_ml_api",
        system_prompt=(
            "You are the RecallOps Regulatory/Risk Officer. Review the shipment sources "
            "for recall approval readiness. Return compact JSON with keys decision, "
            "risk_level, approval_gate, and reason."
        ),
        user_prompt=(
            "Initial shipment CSV:\n"
            f"{shipment_csv.strip()}\n\n"
            "Recovered shipment CSV:\n"
            f"{recovered_shipment_csv.strip()}"
        ),
    )
    return _partner_summary(ai_ml_api, featherless)


def generate_agent_line(
    *,
    role: str,
    instruction: str,
    facts: str,
    fallback: str = "",
    provider: str = "featherless",
) -> str:
    result = _provider_result(provider)
    if result["configured"] is not True:
        return fallback
    system_prompt = (
        f"You are the RecallOps {role} in a product-recall command room. In one or two short "
        "sentences, state your finding using only the provided facts. Be concise and "
        "professional. Do not include routing markers, @mentions, or formatting."
    )
    user_prompt = f"Facts:\n{facts}\n\nTask: {instruction}"
    try:
        content = _chat_completion(
            base_url=str(result["base_url"]),
            api_key=str(result["api_key"]),
            model=str(result["model"]),
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
    except PartnerAIError:
        return fallback
    safe = " ".join(
        word
        for word in content.split()
        if not word.startswith(("RECALLOPS_", "LIVE_")) and word != "SPIKE_DONE"
    )
    return _truncate(safe, 240) if safe else fallback


def _partner_summary(
    ai_ml_api: dict[str, object],
    featherless: dict[str, object],
) -> dict[str, object]:
    used_count = sum(1 for result in (ai_ml_api, featherless) if result["used"] is True)
    public_ai_ml_api = _without_api_key(ai_ml_api)
    public_featherless = _without_api_key(featherless)
    return {
        "mode": "partner_ai_assisted" if used_count else "deterministic_source_parser",
        "disclosure": (
            "Partner providers run only when their API keys are configured and the "
            "partner-AI action is requested. Deterministic parsing remains the source "
            "of truth for shipment math."
        ),
        "used_count": used_count,
        "providers": {
            "ai_ml_api": public_ai_ml_api,
            "featherless": public_featherless,
        },
    }


def _run_provider(
    *,
    provider: str,
    system_prompt: str,
    user_prompt: str,
) -> dict[str, object]:
    result = _provider_result(provider)
    if result["configured"] is not True:
        return result

    prompt_hash = _text_hash(f"{system_prompt}\n{user_prompt}")
    result["prompt_hash"] = prompt_hash
    try:
        content = _chat_completion(
            base_url=str(result["base_url"]),
            api_key=str(result["api_key"]),
            model=str(result["model"]),
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
    except PartnerAIError as exc:
        result["status"] = "error"
        result["error"] = str(exc)
        result.pop("api_key", None)
        return result

    result["used"] = True
    result["status"] = "used"
    result["response_hash"] = _text_hash(content)
    result["output"] = _parse_provider_json(content)
    result.pop("api_key", None)
    return result


def _provider_result(provider: str) -> dict[str, object]:
    if provider == "ai_ml_api":
        api_key = os.getenv("AIML_API_KEY") or os.getenv("AI_ML_API_KEY")
        return {
            "provider": "AI/ML API",
            "configured": bool(api_key),
            "used": False,
            "status": "ready" if api_key else "missing_key",
            "base_url": AIML_BASE_URL,
            "model": os.getenv("RECALLOPS_AIML_MODEL", DEFAULT_AIML_MODEL),
            "role": "risk-decision adapter",
            "api_key": api_key or "",
        }
    if provider == "featherless":
        api_key = os.getenv("FEATHERLESS_API_KEY")
        return {
            "provider": "Featherless",
            "configured": bool(api_key),
            "used": False,
            "status": "ready" if api_key else "missing_key",
            "base_url": FEATHERLESS_BASE_URL,
            "model": os.getenv("RECALLOPS_FEATHERLESS_MODEL", DEFAULT_FEATHERLESS_MODEL),
            "role": "evidence-extraction adapter",
            "api_key": api_key or "",
        }
    raise ValueError(f"Unknown partner provider {provider}.")


def _without_api_key(result: dict[str, object]) -> dict[str, object]:
    public = dict(result)
    public.pop("api_key", None)
    return public


def _chat_completion(
    *,
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
        "max_tokens": 420,
    }
    request = urllib.request.Request(
        url=f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": f"Bearer {api_key}",
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "RecallOps/0.1 (+https://recallops.gudman.xyz)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        detail = detail.replace(api_key, "[redacted]")
        raise PartnerAIError(f"HTTP {exc.code}: {_truncate(detail)}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        detail = str(exc).replace(api_key, "[redacted]")
        raise PartnerAIError(_truncate(detail)) from exc

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise PartnerAIError("Provider response did not include chat content.") from exc
    if not isinstance(content, str) or not content.strip():
        raise PartnerAIError("Provider response content was empty.")
    return content.strip()


def _parse_provider_json(content: str) -> dict[str, object]:
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {"summary": _truncate(content)}
    try:
        parsed = json.loads(content[start : end + 1])
    except json.JSONDecodeError:
        return {"summary": _truncate(content)}
    return _sanitize_json(parsed)


def _sanitize_json(value: Any) -> dict[str, object]:
    if not isinstance(value, dict):
        return {"summary": _truncate(json.dumps(value, sort_keys=True))}
    return {str(key): _sanitize_value(item) for key, item in value.items()}


def _sanitize_value(value: Any) -> object:
    if isinstance(value, str):
        return _truncate(value)
    if isinstance(value, int | float | bool) or value is None:
        return value
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value[:8]]
    if isinstance(value, dict):
        return {str(key): _sanitize_value(item) for key, item in value.items()}
    return _truncate(str(value))


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def _truncate(value: str, limit: int = 500) -> str:
    clean = " ".join(value.split())
    return clean if len(clean) <= limit else f"{clean[:limit]}..."


class PartnerAIError(Exception):
    pass
