import json
from pathlib import Path

from recallops import build_recall_packet


def test_committed_demo_packet_matches_generator() -> None:
    committed = json.loads(Path("web/public/demo-packet.json").read_text(encoding="utf-8"))
    generated = json.loads(json.dumps(build_recall_packet().to_dict()))

    assert committed == generated
