"""List sources in a notebook. Prints JSON to stdout.
Usage: nlm_sources.py <notebook_id>
"""
import asyncio
import json
import sys

if len(sys.argv) < 2:
    print(json.dumps({"error": "Usage: nlm_sources.py <notebook_id>"}))
    sys.exit(1)

notebook_id = sys.argv[1]


async def main():
    try:
        from notebooklm import NotebookLMClient
    except ImportError:
        print(json.dumps({"error": "notebooklm-py not installed"}))
        sys.exit(1)

    try:
        async with await NotebookLMClient.from_storage() as client:
            sources = await client.sources.list(notebook_id)

        result = [
            {
                "id": s.id,
                "title": getattr(s, "title", None) or s.id,
            }
            for s in sources
            if s.is_ready
        ]
        print(json.dumps(result))

    except FileNotFoundError:
        print(json.dumps({"error": "not_connected"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


asyncio.run(main())
