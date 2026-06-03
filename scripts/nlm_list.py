"""List notebooks via notebooklm-py. Prints JSON to stdout.
Requires: notebooklm login to have been run first (stores ~/.notebooklm/storage_state.json)
"""
import asyncio
import json
import sys


async def main():
    try:
        from notebooklm import NotebookLMClient
    except ImportError:
        print(json.dumps({"error": "notebooklm-py not installed"}))
        sys.exit(1)

    try:
        async with NotebookLMClient.from_storage() as client:
            notebooks = await client.notebooks.list()

        result = [
            {
                "id": nb.id,
                "title": getattr(nb, "title", nb.id),
                "source_count": getattr(nb, "source_count", 0),
            }
            for nb in notebooks
        ]
        print(json.dumps(result))

    except FileNotFoundError:
        print(json.dumps({"error": "not_connected"}))
        sys.exit(1)
    except Exception as e:
        msg = str(e)
        if "auth" in msg.lower() or "login" in msg.lower() or "expired" in msg.lower() or "authenticated" in msg.lower():
            print(json.dumps({"error": "not_connected"}))
        else:
            print(json.dumps({"error": msg}))
        sys.exit(1)


asyncio.run(main())
