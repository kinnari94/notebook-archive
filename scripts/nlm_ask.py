"""Ask a question to a NotebookLM notebook.
Usage: nlm_ask.py <notebook_id> <prompt>
Cookie source: NLM_COOKIE env var → NOTEBOOKLM_AUTH_JSON → storage_state.json
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


async def main():
    try:
        from notebooklm import NotebookLMClient
        from notebooklm.auth import AuthTokens, fetch_tokens
    except ImportError:
        print(json.dumps({"error": "notebooklm-py not installed"}))
        sys.exit(1)

    try:
        nlm_cookie = os.environ.get("NLM_COOKIE", "").strip()

        if nlm_cookie:
            cookies_dict = {}
            for part in nlm_cookie.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    cookies_dict[k.strip()] = v.strip()
            csrf, session_id = await fetch_tokens(cookies_dict)
            auth = AuthTokens(cookies=cookies_dict, csrf_token=csrf, session_id=session_id)
            async with NotebookLMClient(auth) as client:
                result = await client.chat.ask(notebook_id, prompt)
        else:
            async with await NotebookLMClient.from_storage() as client:
                result = await client.chat.ask(notebook_id, prompt)

        print(json.dumps({"answer": result.answer}))

    except FileNotFoundError:
        print(json.dumps({"error": "not_connected"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


asyncio.run(main())
