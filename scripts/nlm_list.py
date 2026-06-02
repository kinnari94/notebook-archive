"""List notebooks via notebooklm-py. Prints JSON to stdout.
Auth source priority:
  1. GOOGLE_ACCESS_TOKEN env var  (from NextAuth Google OAuth session)
  2. NLM_COOKIE env var           (per-user cookie string)
  3. NOTEBOOKLM_AUTH_JSON env var (server-level hosting)
  4. ~/.notebooklm/storage_state.json (local dev via notebooklm login)
"""
import asyncio
import json
import os
import sys


async def main():
    try:
        from notebooklm import NotebookLMClient
        from notebooklm.auth import AuthTokens, fetch_tokens
    except ImportError:
        print(json.dumps({"error": "notebooklm-py not installed"}))
        sys.exit(1)

    try:
        access_token = os.environ.get("GOOGLE_ACCESS_TOKEN", "").strip()
        nlm_cookie   = os.environ.get("NLM_COOKIE", "").strip()

        if access_token:
            async with NotebookLMClient(access_token=access_token) as client:
                notebooks = await client.notebooks.list()
        elif nlm_cookie:
            cookies_dict = {}
            for part in nlm_cookie.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    cookies_dict[k.strip()] = v.strip()
            csrf, session_id = await fetch_tokens(cookies_dict)
            auth = AuthTokens(cookies=cookies_dict, csrf_token=csrf, session_id=session_id)
            async with NotebookLMClient(auth) as client:
                notebooks = await client.notebooks.list()
        else:
            async with await NotebookLMClient.from_storage() as client:
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
