"""
Login to NotebookLM using Google email + password via Playwright.
Usage: nlm_login_credentials.py <email> <password>
Prints JSON: {"ok": true} or {"ok": false, "error": "..."}
"""
import json, sys
from pathlib import Path
from urllib.parse import urlparse

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

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

try:
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(BROWSER_PROFILE),
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1280,800",
                "--password-store=basic",
            ],
            ignore_default_args=["--enable-automation"],
            user_agent=UA,
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            timezone_id="America/New_York",
        )

        page = context.new_page()

        # Override navigator.webdriver so Google doesn't flag us
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        page.goto(
            "https://accounts.google.com/signin/v2/identifier"
            "?continue=https%3A%2F%2Fnotebooklm.google.com%2F"
            "&hl=en&flowName=GlifWebSignIn&flowEntry=ServiceLogin",
            wait_until="domcontentloaded",
            timeout=30000,
        )

        # If already signed in and redirected to NotebookLM, save state and exit
        # (checked via hostname, not substring — the initial goto URL's own
        # ?continue= query param literally contains "notebooklm.google.com"
        # and would false-positive a naive substring check)
        if urlparse(page.url).hostname == "notebooklm.google.com":
            context.storage_state(path=str(STORAGE_PATH))
            STORAGE_PATH.chmod(0o600)
            context.close()
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Handle "Choose an account" screen (stale session in profile)
        try:
            use_another = page.locator("text=Use another account").first
            if use_another.is_visible(timeout=3000):
                use_another.click()
                page.wait_for_load_state("domcontentloaded", timeout=10000)
        except Exception:
            pass

        # --- Email step ---
        email_selectors = [
            'input[type="email"]',
            'input[name="identifier"]',
            '#identifierId',
        ]
        email_input = None
        for sel in email_selectors:
            try:
                page.wait_for_selector(sel, state="visible", timeout=15000)
                email_input = page.locator(sel).first
                break
            except Exception:
                continue

        if email_input is None:
            context.close()
            print(json.dumps({"ok": False, "error": f"Could not find email input. Page URL: {page.url}"}))
            sys.exit(1)

        email_input.fill(email)
        page.wait_for_timeout(500)

        # Click Next — try ID then aria-label
        next_btn = page.locator('#identifierNext button, [data-action="next"] button, #identifierNext').first
        next_btn.click()

        # --- Password step ---
        pw_selectors = [
            'input[type="password"]',
            'input[name="Passwd"]',
            'input[name="password"]',
        ]
        pw_input = None
        for sel in pw_selectors:
            try:
                page.wait_for_selector(sel, state="visible", timeout=15000)
                pw_input = page.locator(sel).first
                break
            except Exception:
                continue

        if pw_input is None:
            context.close()
            print(json.dumps({"ok": False, "error": f"Could not find password input. Page URL: {page.url}"}))
            sys.exit(1)

        pw_input.fill(password)
        page.wait_for_timeout(500)

        pw_next = page.locator('#passwordNext button, [data-action="next"] button, #passwordNext').first
        pw_next.click()

        # --- Wait for outcome ---
        try:
            page.wait_for_url("**/notebooklm.google.com/**", timeout=30000)
        except Exception:
            url = page.url
            content = page.content()

            if any(x in url or x in content for x in [
                "signin/v2/challenge", "TwoStep", "two-step", "2-Step",
                "challenge", "totp", "phone",
            ]):
                context.close()
                print(json.dumps({"ok": False, "error": "2-Step Verification required. Please disable 2FA temporarily or use an App Password."}))
                sys.exit(1)

            if "accounts.google.com" in url:
                # Could be wrong password or captcha
                err_text = ""
                try:
                    err_el = page.locator('[aria-live="assertive"], .o6cuMc, .dEOOab').first
                    if err_el.is_visible(timeout=2000):
                        err_text = err_el.inner_text()
                except Exception:
                    pass
                context.close()
                msg = f"Login failed: {err_text}" if err_text else "Login failed. Check your email and password."
                print(json.dumps({"ok": False, "error": msg}))
                sys.exit(1)

            context.close()
            print(json.dumps({"ok": False, "error": f"Unexpected redirect to: {url}"}))
            sys.exit(1)

        context.storage_state(path=str(STORAGE_PATH))
        STORAGE_PATH.chmod(0o600)
        context.close()
        print(json.dumps({"ok": True}))

except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
