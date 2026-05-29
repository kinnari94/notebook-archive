import streamlit as st
import time
from datetime import datetime

from utils.notebooklm_client import list_notebooks, ask_notebook, is_notebooklm_available
from utils.parser import parse_response, clean_response_text
from utils.db import insert_incidents, log_extraction_job, update_extraction_job, get_db
from prompts.extraction_prompts import PROMPTS, CATEGORY_META


def render():
    st.markdown("## ⚗️ Extract from NotebookLM")

    db = get_db()
    if db is None:
        st.error("MongoDB not connected. Configure in ⚙️ Settings first.")
        return

    # ── NotebookLM status ────────────────────────────────────────────────────
    if not is_notebooklm_available():
        st.markdown("""
        <div style="background:#2a1810;border:1px solid #d9803055;border-radius:4px;padding:1rem 1.2rem;margin-bottom:1rem;">
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:#f5a860;font-weight:600;margin-bottom:6px;">
            📦 notebooklm-py not installed
          </div>
          <div style="font-size:13px;color:#c8b89a;">Run the following in your terminal to install:</div>
          <div style="background:#0a0806;border:1px solid #2e2010;border-radius:2px;padding:8px 12px;
                      font-family:'DM Mono',monospace;font-size:11px;color:#90a060;margin-top:8px;">
            pip install "notebooklm-py[browser]"<br>
            playwright install chromium<br>
            notebooklm login
          </div>
        </div>
        """, unsafe_allow_html=True)

    # ── Step 1: Select Notebooks ─────────────────────────────────────────────
    st.markdown("### Step 1 — Select Notebooks")

    col_fetch, col_space = st.columns([2, 5])
    with col_fetch:
        fetch_btn = st.button("🔄 Load My Notebooks", use_container_width=True)

    if fetch_btn or "notebooks_list" in st.session_state:
        if fetch_btn:
            with st.spinner("Connecting to NotebookLM..."):
                notebooks, err = list_notebooks()
            if err:
                st.error(err)
                st.session_state.pop("notebooks_list", None)
            else:
                st.session_state["notebooks_list"] = notebooks

        notebooks = st.session_state.get("notebooks_list", [])
        if notebooks:
            st.markdown(f"""
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:#5a4e3a;margin-bottom:8px;">
                {len(notebooks)} notebooks found
            </div>""", unsafe_allow_html=True)

            # Build options
            nb_options = {f"{nb['title']} ({nb.get('source_count',0)} sources)": nb["id"]
                          for nb in notebooks}

            selected_labels = st.multiselect(
                "Select notebooks to process",
                options=list(nb_options.keys()),
                default=[],
                help="You can select multiple notebooks. Each will be processed separately."
            )
            selected_ids = [nb_options[label] for label in selected_labels]
        else:
            st.info("No notebooks found. Make sure you are authenticated with NotebookLM.")
            selected_ids = []
    else:
        selected_ids = []
        st.caption("Click 'Load My Notebooks' to fetch your NotebookLM notebooks.")

    # ── Step 2: Select Categories ────────────────────────────────────────────
    st.markdown("### Step 2 — Select Extraction Categories")

    st.markdown("""
    <div style="font-size:12px;color:#7a7060;margin-bottom:10px;">
        Each category runs a separate extraction prompt against the selected notebooks.
        Select only what is relevant to the notebooks you chose.
    </div>""", unsafe_allow_html=True)

    # Apply select-all / clear-all from previous run BEFORE checkboxes render
    if st.session_state.pop("_cat_select_all", False):
        for key in PROMPTS:
            st.session_state[f"cat_{key}"] = True
    if st.session_state.pop("_cat_clear_all", False):
        for key in PROMPTS:
            st.session_state[f"cat_{key}"] = False

    # Group display
    col_a, col_b = st.columns(2)
    selected_prompts = []

    prompt_items = list(PROMPTS.items())
    half = len(prompt_items) // 2 + len(prompt_items) % 2

    def prompt_checkbox(key, data, col):
        with col:
            label = data['label']
            checked = st.checkbox(label, key=f"cat_{key}", value=False)
            if checked:
                selected_prompts.append(key)

    for i, (key, data) in enumerate(prompt_items):
        if i < half:
            prompt_checkbox(key, data, col_a)
        else:
            prompt_checkbox(key, data, col_b)

    # Select all / none — set trigger flag then rerun so state is applied before checkboxes
    sa1, sa2, _ = st.columns([1, 1, 5])
    with sa1:
        if st.button("Select All"):
            st.session_state["_cat_select_all"] = True
            st.rerun()
    with sa2:
        if st.button("Clear All"):
            st.session_state["_cat_clear_all"] = True
            st.rerun()

    # ── Step 3: Access tier ──────────────────────────────────────────────────
    st.markdown("### Step 3 — Access Tier")
    tier = st.radio(
        "What tier of content is in these notebooks?",
        options=["🟢 Tier 1 — Public (satsangs, teachings, events)",
                 "🟡 Tier 2 — Controlled (travel logs, personal discipline, guidance)",
                 "🔴 Tier 3 — Restricted (health records, confessional content)"],
        index=0,
        help="This sets the access tier tag on all extracted incidents from this batch."
    )
    tier_value = 1 if "Tier 1" in tier else (2 if "Tier 2" in tier else 3)

    # ── Run ──────────────────────────────────────────────────────────────────
    st.markdown("---")
    ready = bool(selected_ids and selected_prompts)

    if not selected_ids:
        st.caption("⬆ Load and select at least one notebook above.")
    if not selected_prompts:
        st.caption("⬆ Select at least one extraction category above.")

    run_btn = st.button(
        f"🚀 Run Extraction  ({len(selected_ids)} notebooks × {len(selected_prompts)} categories = {len(selected_ids)*len(selected_prompts)} queries)",
        disabled=not ready,
        type="primary",
        use_container_width=True,
    )

    if run_btn:
        run_extraction(selected_ids, selected_prompts, tier_value,
                       st.session_state.get("notebooks_list", []))


def run_extraction(notebook_ids, prompt_keys, tier_value, notebooks_meta):
    """Execute the full extraction pipeline with live progress UI."""

    nb_lookup = {nb["id"]: nb["title"] for nb in notebooks_meta}
    total_queries = len(notebook_ids) * len(prompt_keys)
    total_inserted = 0

    # Log header
    log_placeholder = st.empty()
    progress_bar = st.progress(0.0)
    status_text  = st.empty()
    log_lines = []

    def log(msg, cls="log-info"):
        ts = datetime.now().strftime("%H:%M:%S")
        log_lines.append(f'<span class="{cls}">[{ts}] {msg}</span>')
        log_placeholder.markdown(
            f'<div class="log-console">{"<br>".join(log_lines[-20:])}</div>',
            unsafe_allow_html=True
        )

    log("Starting extraction pipeline...", "log-info")

    query_num = 0
    for nb_id in notebook_ids:
        nb_title = nb_lookup.get(nb_id, nb_id)
        log(f"Notebook: {nb_title}", "log-ok")

        # Log this job
        job_doc = {
            "notebook_id": nb_id,
            "notebook_title": nb_title,
            "categories_run": prompt_keys,
            "status": "running",
            "started_at": datetime.utcnow(),
            "incidents_inserted": 0,
            "tier": tier_value,
        }

        for pkey in prompt_keys:
            query_num += 1
            pdata = PROMPTS[pkey]
            progress_bar.progress(query_num / total_queries)
            status_text.markdown(
                f'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:#7a7060;">'
                f'Query {query_num}/{total_queries} · {pdata["label"]}</div>',
                unsafe_allow_html=True
            )
            log(f"  → {pdata['label']}", "log-info")

            # Query NotebookLM
            answer, err = ask_notebook(nb_id, pdata["prompt"])

            if err:
                log(f"     ERROR: {err}", "log-err")
                continue

            # Clean and parse
            cleaned  = clean_response_text(answer)
            incidents = parse_response(cleaned, pdata["category"], tier_value)

            if not incidents:
                log(f"     No incidents found.", "log-warn")
                continue

            # Override tier from the run setting
            for inc in incidents:
                inc["access_tier"] = max(inc.get("access_tier", 1), tier_value)

            # Insert to MongoDB
            source_meta = {"notebook_id": nb_id, "notebook_title": nb_title}
            inserted = insert_incidents(incidents, source_meta)
            total_inserted += inserted
            log(f"     ✓ {inserted} incidents stored", "log-ok")

            time.sleep(0.3)  # polite pacing

        # Update job log
        job_doc["status"] = "done"
        job_doc["incidents_inserted"] = total_inserted
        job_doc["finished_at"] = datetime.utcnow()
        from utils.db import get_db
        db = get_db()
        if db:
            db["extraction_jobs"].insert_one(job_doc)

    progress_bar.progress(1.0)
    status_text.empty()
    log(f"━━ Extraction complete. {total_inserted} total incidents stored. ━━", "log-ok")

    st.success(f"✅ Done — {total_inserted} incidents extracted and stored in MongoDB.")
    if st.button("📜 Browse Extracted Incidents"):
        st.rerun()
