"""Ask a question to a NotebookLM notebook.
Usage: nlm_ask.py <notebook_id> <prompt>
Requires: notebooklm login to have been run first (stores ~/.notebooklm/storage_state.json)
"""
import asyncio
import json
import os
import sys

if len(sys.argv) < 3:
    print(json.dumps({"error": "Usage: nlm_ask.py <notebook_id> <prompt>"}))
    sys.exit(1)

notebook_id = sys.argv[1]
prompt = sys.argv[2]

# Shared/large notebooks can take well past the library's 180s default to send
# the first response byte. Override via NOTEBOOKLM_CHAT_TIMEOUT if needed.
CHAT_TIMEOUT = float(os.environ.get("NOTEBOOKLM_CHAT_TIMEOUT", "300"))


async def main():
    try:
        from notebooklm import NotebookLMClient
    except ImportError:
        print(json.dumps({"error": "notebooklm-py not installed"}))
        sys.exit(1)

    try:
        async with await NotebookLMClient.from_storage(chat_timeout=CHAT_TIMEOUT) as client:
            result = await client.chat.ask(notebook_id, prompt)

        print(json.dumps({"answer": result.answer, "references": []}))

    except FileNotFoundError:
        print(json.dumps({"error": "not_connected"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


asyncio.run(main())
