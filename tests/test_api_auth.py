import pytest
from fastapi import HTTPException

from api.auth import load_valid_keys, require_api_key


def test_load_valid_keys_parses_comma_separated_list(monkeypatch):
    monkeypatch.setenv("SKYMETRICS_API_KEYS", "key-one, key-two")

    assert load_valid_keys() == {"key-one", "key-two"}


def test_load_valid_keys_raises_when_unset(monkeypatch):
    monkeypatch.delenv("SKYMETRICS_API_KEYS", raising=False)

    with pytest.raises(RuntimeError):
        load_valid_keys()


def test_load_valid_keys_raises_when_it_parses_to_zero_keys(monkeypatch):
    monkeypatch.setenv("SKYMETRICS_API_KEYS", " , ")

    with pytest.raises(RuntimeError):
        load_valid_keys()


def test_require_api_key_accepts_a_valid_key(monkeypatch):
    monkeypatch.setenv("SKYMETRICS_API_KEYS", "good-key")

    assert require_api_key(x_api_key="good-key") == "good-key"


def test_require_api_key_rejects_an_invalid_key(monkeypatch):
    monkeypatch.setenv("SKYMETRICS_API_KEYS", "good-key")

    with pytest.raises(HTTPException) as exc_info:
        require_api_key(x_api_key="wrong-key")

    assert exc_info.value.status_code == 401
