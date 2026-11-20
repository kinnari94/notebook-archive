"""Print the full indexed text of every ready source in a notebook, as JSON.
Usage: nlm_fulltext.py <notebook_id>
Output: [{"id": ..., "title": ..., "content": ...}, ...]
Requires: notebooklm login to have been run first (stores ~/.notebooklm/storage_state.json)
"""
import asyncio
import json
import sys

if len(sys.argv) < 2:
    print(json.dumps({"error": "Usage: nlm_fulltext.py <notebook_id>"}))
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
            sources = [s for s in await client.sources.list(notebook_id) if s.is_ready]
            out = []
            for s in sources:
                title = getattr(s, "title", None) or s.id
                try:
                    ft = await client.sources.get_fulltext(notebook_id, s.id)
                    out.append({"id": s.id, "title": title, "content": ft.content or ""})
                except Exception as e:  # one bad source shouldn't stop the rest
                    out.append({"id": s.id, "title": title, "content": "", "error": str(e)})
        print(json.dumps(out))

    except FileNotFoundError:
        print(json.dumps({"error": "not_connected"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


asyncio.run(main())
