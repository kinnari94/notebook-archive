"""
Login to NotebookLM using Google email + password via Playwright.
Usage: nlm_login_credentials.py <email> <password>
Prints JSON: {"ok": true} or {"ok": false, "error": "..."}
"""
import json, sys, time
from pathlib import Path

if len(sys.argv) < 3:
    print(json.dumps({"ok": False, "error": "Usage: nlm_login_credentials.py <email> <password>"}))
    sys.exit(1)

email = sys.argv[1]
password = sys.argv[2]

STORAGE_DIR = Path.home() / ".notebooklm"
STORAGE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
STORAGE_PATH = STORAGE_DIR / "storage_state.json"
BROWSER_PROFILE = STORAGE_DIR / "profiles" / "default"
BROWSER_PROFILE.mkdir(parents=True, exist_ok=True, mode=0o700)

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print(json.dumps({"ok": False, "error": "Playwright not installed. Run: pip install playwright && playwright install chromium"}))
    sys.exit(1)

try:
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(BROWSER_PROFILE),
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--password-store=basic",
                "--no-sandbox",
            ],
            ignore_default_args=["--enable-automation"],
        )

        page = context.new_page()
        page.goto("https://accounts.google.com/signin/v2/identifier?continue=https://notebooklm.google.com/")

        # Enter email
        page.wait_for_selector('input[type="email"]', timeout=10000)
        page.fill('input[type="email"]', email)
        page.click('#identifierNext, [id="identifierNext"]')

        # Enter password
        page.wait_for_selector('input[type="password"]', timeout=10000)
        page.fill('input[type="password"]', password)
        page.click('#passwordNext, [id="passwordNext"]')

        # Wait to land on NotebookLM
        try:
            page.wait_for_url("**/notebooklm.google.com/**", timeout=20000)
        except Exception:
            # Check where we ended up
            url = page.url
            content = page.content()
            if "accounts.google.com/signin/v2/challenge" in url or "2-Step" in content:
                context.close()
                print(json.dumps({"ok": False, "error": "2-Step Verification required. Disable 2FA or use notebooklm login from terminal."}))
                sys.exit(1)
            if "accounts.google.com" in url:
                context.close()
                print(json.dumps({"ok": False, "error": "Login failed. Check your email and password."}))
                sys.exit(1)

        # Verify we're authenticated (page has SNlM0e token)
        content = page.content()
        if "SNlM0e" not in content:
            context.close()
            print(json.dumps({"ok": False, "error": "Reached NotebookLM but not authenticated. Try again."}))
            sys.exit(1)

        state = context.storage_state(path=str(STORAGE_PATH))
        STORAGE_PATH.chmod(0o600)
        context.close()

        print(json.dumps({"ok": True}))

except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
