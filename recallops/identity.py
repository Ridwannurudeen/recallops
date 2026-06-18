from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa


APPROVAL_KEY_ENV = "RECALLOPS_APPROVAL_ADMIN_KEY"
OIDC_ISSUER_ENV = "RECALLOPS_OIDC_ISSUER"
OIDC_AUDIENCE_ENV = "RECALLOPS_OIDC_AUDIENCE"
OIDC_JWKS_URL_ENV = "RECALLOPS_OIDC_JWKS_URL"


def identity_status() -> dict[str, object]:
    oidc_ready = _oidc_ready()
    return {
        "mode": "oidc_jwks_or_admin_key",
        "disclosure": (
            "Identity-gated approvals require either a verified OIDC bearer token "
            "or a server-side approval admin key. Public receipt generation remains "
            "available for demo hashing, but identity approval is a protected path."
        ),
        "approval_admin_key_configured": bool(_approval_key()),
        "approval_gate_ready": bool(_approval_key()) or oidc_ready,
        "oidc": {
            "issuer_configured": bool(os.getenv(OIDC_ISSUER_ENV)),
            "audience_configured": bool(os.getenv(OIDC_AUDIENCE_ENV)),
            "jwks_url_configured": bool(os.getenv(OIDC_JWKS_URL_ENV)),
            "verification_ready": oidc_ready,
        },
    }


def resolve_approval_identity(
    *,
    approver: str,
    provided_admin_key: str | None,
    authorization: str | None,
) -> dict[str, object]:
    bearer_token = _bearer_token(authorization)
    if bearer_token and _oidc_ready():
        return _verify_oidc_identity(bearer_token)
    return _verify_admin_key_identity(approver, provided_admin_key)


def _verify_admin_key_identity(
    approver: str,
    provided_admin_key: str | None,
) -> dict[str, object]:
    expected_key = _approval_key()
    if not expected_key or not provided_admin_key:
        raise IdentityError(403, "Identity approval requires an approval admin key or OIDC token.")
    if not hmac.compare_digest(provided_admin_key, expected_key):
        raise IdentityError(403, "Identity approval requires an approval admin key or OIDC token.")

    clean_approver = approver.strip()
    if not clean_approver:
        raise IdentityError(400, "Approver is required.")
    return _with_identity_hash(
        {
            "mode": "server_admin_key",
            "subject": f"recallops-admin:{_text_hash(clean_approver)[:12]}",
            "display_name": clean_approver,
            "email": "",
            "issuer": "recallops-admin-gate",
            "assurance_level": "server_verified_shared_secret",
            "verified_at": _now(),
        }
    )


def _verify_oidc_identity(token: str) -> dict[str, object]:
    header, payload, signing_input, signature = _decode_jwt(token)
    if header.get("alg") != "RS256":
        raise IdentityError(401, "OIDC token must use RS256.")

    issuer = os.getenv(OIDC_ISSUER_ENV, "").rstrip("/")
    audience = os.getenv(OIDC_AUDIENCE_ENV, "")
    if str(payload.get("iss", "")).rstrip("/") != issuer:
        raise IdentityError(401, "OIDC issuer mismatch.")
    if not _audience_matches(payload.get("aud"), audience):
        raise IdentityError(401, "OIDC audience mismatch.")
    _verify_time_claims(payload)

    public_key = _public_key_for(header)
    try:
        public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
    except InvalidSignature as exc:
        raise IdentityError(401, "OIDC token signature verification failed.") from exc

    subject = str(payload.get("sub", "")).strip()
    if not subject:
        raise IdentityError(401, "OIDC token is missing subject.")
    return _with_identity_hash(
        {
            "mode": "oidc_jwks",
            "subject": subject,
            "display_name": str(
                payload.get("name")
                or payload.get("preferred_username")
                or payload.get("email")
                or subject
            ),
            "email": str(payload.get("email", "")),
            "issuer": issuer,
            "audience": audience,
            "assurance_level": "verified_oidc_jwt",
            "verified_at": _now(),
            "token_hash": _text_hash(token),
        }
    )


def _public_key_for(header: dict[str, Any]) -> rsa.RSAPublicKey:
    kid = str(header.get("kid", ""))
    jwks = _fetch_jwks(str(os.getenv(OIDC_JWKS_URL_ENV)))
    keys = jwks.get("keys", [])
    if not isinstance(keys, list):
        raise IdentityError(502, "OIDC JWKS response is invalid.")
    for key in keys:
        if isinstance(key, dict) and key.get("kid") == kid:
            return _rsa_public_key_from_jwk(key)
    raise IdentityError(401, "OIDC token key ID was not found in JWKS.")


def _rsa_public_key_from_jwk(jwk: dict[str, Any]) -> rsa.RSAPublicKey:
    if jwk.get("kty") != "RSA":
        raise IdentityError(401, "OIDC JWKS key must be RSA.")
    n = int.from_bytes(_b64url_decode(str(jwk.get("n", ""))), "big")
    e = int.from_bytes(_b64url_decode(str(jwk.get("e", ""))), "big")
    return rsa.RSAPublicNumbers(e=e, n=n).public_key()


def _fetch_jwks(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url=url,
        headers={
            "accept": "application/json",
            "user-agent": "RecallOps/0.1 (+https://recallops.gudman.xyz)",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, OSError, json.JSONDecodeError) as exc:
        raise IdentityError(502, f"OIDC JWKS fetch failed: {_truncate(str(exc))}") from exc
    if not isinstance(body, dict):
        raise IdentityError(502, "OIDC JWKS response is invalid.")
    return body


def _decode_jwt(token: str) -> tuple[dict[str, Any], dict[str, Any], bytes, bytes]:
    parts = token.split(".")
    if len(parts) != 3:
        raise IdentityError(401, "OIDC token must be a compact JWT.")
    try:
        header = json.loads(_b64url_decode(parts[0]).decode("utf-8"))
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise IdentityError(401, "OIDC token could not be decoded.") from exc
    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise IdentityError(401, "OIDC token header and payload must be objects.")
    return header, payload, f"{parts[0]}.{parts[1]}".encode("ascii"), _b64url_decode(parts[2])


def _verify_time_claims(payload: dict[str, Any]) -> None:
    now = int(time.time())
    exp = int(payload.get("exp", 0))
    if exp <= now:
        raise IdentityError(401, "OIDC token is expired.")
    nbf = payload.get("nbf")
    if nbf is not None and int(nbf) > now:
        raise IdentityError(401, "OIDC token is not yet valid.")
    iat = payload.get("iat")
    if iat is not None and int(iat) > now + 60:
        raise IdentityError(401, "OIDC token issue time is in the future.")


def _audience_matches(value: object, expected: str) -> bool:
    if isinstance(value, str):
        return value == expected
    if isinstance(value, list):
        return expected in [str(item) for item in value]
    return False


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _oidc_ready() -> bool:
    return bool(
        os.getenv(OIDC_ISSUER_ENV) and os.getenv(OIDC_AUDIENCE_ENV) and os.getenv(OIDC_JWKS_URL_ENV)
    )


def _approval_key() -> str:
    return os.getenv(APPROVAL_KEY_ENV) or os.getenv("RECALLOPS_ADMIN_ACTION_KEY", "")


def _with_identity_hash(identity: dict[str, object]) -> dict[str, object]:
    payload = dict(identity)
    payload["identity_proof_hash"] = _payload_hash(identity)
    return payload


def _payload_hash(payload: dict[str, object]) -> str:
    return _text_hash(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def _text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _b64url_decode(value: str) -> bytes:
    padding_size = (-len(value)) % 4
    return base64.urlsafe_b64decode(f"{value}{'=' * padding_size}".encode("ascii"))


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _truncate(value: str, limit: int = 240) -> str:
    clean = " ".join(value.split())
    return clean if len(clean) <= limit else f"{clean[:limit]}..."


class IdentityError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)
