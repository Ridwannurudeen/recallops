import pytest


@pytest.fixture(autouse=True)
def _isolate_case_db(tmp_path, monkeypatch):
    monkeypatch.setenv("RECALLOPS_CASE_DB", str(tmp_path / "recallops-cases.sqlite3"))
