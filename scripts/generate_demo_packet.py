from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from recallops import build_recall_packet


def main() -> None:
    packet = build_recall_packet()
    output = Path("web/public/demo-packet.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(packet.to_dict(), indent=2), encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
