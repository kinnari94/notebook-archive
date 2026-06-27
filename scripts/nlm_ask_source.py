"""Ask a question scoped to a single source in a NotebookLM notebook.
Usage: nlm_ask_source.py <notebook_id> <source_id> <prompt>
"""
import asyncio
import json
import sys

if len(sys.argv) < 4:
    print(json.dumps({"error": "Usage: nlm_ask_source.py <notebook_id> <source_id> <prompt>"}))
    sys.exit(1)

notebook_id = sys.argv[1]
source_id   = sys.argv[2]
prompt      = sys.argv[3]


async def main():
    try:
        from notebooklm import NotebookLMClient
    except ImportError:
        print(json.dumps({"error": "notebooklm-py not installed"}))
        sys.exit(1)

    try:
        async with await NotebookLMClient.from_storage() as client:
            result = await client.chat.ask(notebook_id, prompt, source_ids=[source_id])

        print(json.dumps({"answer": result.answer, "references": []}))

    except FileNotFoundError:
        print(json.dumps({"error": "not_connected"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


asyncio.run(main())
