"""
Non-interactive NotebookLM login script.
Opens a browser, waits for the user to sign in, then auto-saves cookies.
Writes a JSON result to stdout: {"ok": true} or {"ok": false, "error": "..."}
"""
import json
import os
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print(json.dumps({"ok": False, "error": "Playwright not installed. Run: pip3 install playwright && playwright install chromium"}))
    sys.exit(1)

COOKIE_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / ".notebooklm_cookie"
STORAGE_DIR = Path.home() / ".notebooklm"
STORAGE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
STORAGE_PATH = STORAGE_DIR / "storage_state.json"
BROWSER_PROFILE = STORAGE_DIR / "profiles" / "default"
BROWSER_PROFILE.mkdir(parents=True, exist_ok=True, mode=0o700)

def is_logged_in(page) -> bool:
    try:
        url = page.url
        if "accounts.google.com" in url:
            return False
        if "notebooklm.google.com" not in url:
            return False
        # Check that the page has loaded (SNlM0e token is present)
        content = page.content()
        return "SNlM0e" in content
    except Exception:
        return False

def extract_cookie_str(storage_state: dict) -> str:
    cookies = storage_state.get("cookies", [])
    google_cookies = [c for c in cookies if "google" in c.get("domain", "")]
    return "; ".join(f"{c['name']}={c['value']}" for c in google_cookies)

try:
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(BROWSER_PROFILE),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--password-store=basic",
            ],
            ignore_default_args=["--enable-automation"],
        )

        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://notebooklm.google.com/")

        # Poll until logged in (max 5 minutes)
        deadline = time.time() + 300
        while time.time() < deadline:
            if is_logged_in(page):
                break
            time.sleep(2)
        else:
            context.close()
            print(json.dumps({"ok": False, "error": "Login timed out after 5 minutes"}))
            sys.exit(1)

        # Save storage state
        state = context.storage_state(path=str(STORAGE_PATH))
        STORAGE_PATH.chmod(0o600)
        context.close()

        # Extract and write cookie string
        cookie_str = extract_cookie_str(state)
        COOKIE_FILE.write_text(cookie_str, encoding="utf-8")

        print(json.dumps({"ok": True}))

except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
