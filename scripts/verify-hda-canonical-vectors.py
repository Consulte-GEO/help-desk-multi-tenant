#!/usr/bin/env python3
"""Independent stdlib conformance check for HDA-CJSON-1 fixed vectors.

This is not a .NET certification and never calls a server or modifies a database.
Run: python scripts/verify-hda-canonical-vectors.py [canonical-vectors.v1.json]
"""
from __future__ import annotations
import hashlib
import json
import pathlib
import sys
from typing import Any

MAX_BYTES = 65536
MAX_STRING_BYTES = 16384
MAX_DEPTH = 16
MAX_NODES = 4096
MAX_SAFE_INTEGER = 9007199254740991
FORBIDDEN_KEYS = {"__proto__", "prototype", "constructor"}


def canonical(value: Any) -> str:
    nodes = 0
    total = 0

    def spend(text: str) -> str:
        nonlocal total
        total += len(text.encode("utf-8", errors="strict"))
        if total > MAX_BYTES:
            raise ValueError("byte_budget")
        return text

    def string(text: str) -> str:
        if "\0" in text or len(text.encode("utf-8", errors="strict")) > MAX_STRING_BYTES:
            raise ValueError("invalid_string")
        return json.dumps(text, ensure_ascii=False, separators=(",", ":"))

    def visit(item: Any, depth: int) -> str:
        nonlocal nodes
        nodes += 1
        if nodes > MAX_NODES or depth > MAX_DEPTH:
            raise ValueError("shape_budget")
        if item is None:
            return spend("null")
        if type(item) is bool:
            return spend("true" if item else "false")
        if type(item) is int:
            if abs(item) > MAX_SAFE_INTEGER:
                raise ValueError("invalid_integer")
            return spend(str(item))
        if type(item) is str:
            return spend(string(item))
        if type(item) is list:
            if len(item) > 256:
                raise ValueError("array_budget")
            spend("[]" + "," * max(0, len(item) - 1))
            return "[" + ",".join(visit(child, depth + 1) for child in item) + "]"
        if type(item) is dict:
            if len(item) > 128:
                raise ValueError("key_budget")
            if any(type(key) is not str or not 1 <= len(key) <= 100
                   or any(ord(c) < 32 or ord(c) > 126 for c in key)
                   or key in FORBIDDEN_KEYS for key in item):
                raise ValueError("invalid_key")
            spend("{}" + "," * max(0, len(item) - 1))
            members = []
            for key in sorted(item):
                encoded_key = spend(string(key) + ":")
                members.append(encoded_key + visit(item[key], depth + 1))
            return "{" + ",".join(members) + "}"
        raise ValueError("not_profile_json")

    return visit(value, 0)


def parse(text: str) -> Any:
    if len(text.encode("utf-8", errors="strict")) > MAX_BYTES:
        raise ValueError("byte_budget")

    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise ValueError("duplicate_key")
            result[key] = value
        return result

    def integer(text: str) -> int:
        if text == "-0":
            raise ValueError("negative_zero")
        return int(text)

    def forbidden(_: str) -> Any:
        raise ValueError("invalid_number")

    value = json.loads(text, object_pairs_hook=pairs, parse_int=integer,
                       parse_float=forbidden, parse_constant=forbidden)
    canonical(value)
    return value


def main() -> int:
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) == 2 else (
        pathlib.Path(__file__).resolve().parent.parent
        / "tests/fixtures/registration/canonical-vectors.v1.json"
    )
    if len(sys.argv) > 2:
        print("Usage: verify-hda-canonical-vectors.py [vectors.json]", file=sys.stderr)
        return 2
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("profile") != "hda-cjson-v1" or data.get("dotnetVerified") is not False:
            raise ValueError("invalid_manifest")
        seen: set[str] = set()
        for row in data["valid"]:
            if row["id"] in seen:
                raise ValueError("duplicate_vector")
            seen.add(row["id"])
            result = canonical(row["input"])
            encoded = result.encode("utf-8")
            if (result != row["canonical"] or encoded.hex() != row["utf8Hex"]
                    or hashlib.sha256(encoded).hexdigest() != row["sha256"]):
                raise ValueError("valid_vector_mismatch")
        for row in data["invalid"]:
            if row["id"] in seen:
                raise ValueError("duplicate_vector")
            seen.add(row["id"])
            try:
                parse(row["raw"])
            except (ValueError, RecursionError, UnicodeError):
                continue
            raise ValueError("invalid_vector_accepted")
        print(json.dumps({"profile": data["profile"], "implementation": "independent-python-stdlib",
                          "valid_passed": len(data["valid"]), "invalid_rejected": len(data["invalid"]),
                          "failed": 0, "dotnet_verified": False}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, RecursionError, UnicodeError):
        # Intentionally exclude raw vectors, filenames supplied externally and error payloads.
        print(json.dumps({"failed": 1, "code": "hda_vector_verification_failed", "dotnet_verified": False}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
