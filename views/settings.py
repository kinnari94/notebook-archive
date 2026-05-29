import streamlit as st
from utils.db import test_connection, ensure_text_index


def render():
    st.markdown("## ⚙️ Settings")

    # ── MongoDB Atlas ────────────────────────────────────────────────────────
    st.markdown("### MongoDB Atlas")
    st.markdown("""
    <div style="font-size:13px;color:#595959;margin-bottom:14px;font-family:'Inter',sans-serif;line-height:1.7;">
        Your MongoDB Atlas connection string.<br>
        <code style="font-size:11px;color:#3DCD8B;background:#061209;padding:2px 8px;
                     border-radius:6px;border:1px solid rgba(61,205,139,0.18);">
            mongodb+srv://user:password@cluster.mongodb.net/
        </code>
    </div>""", unsafe_allow_html=True)

    uri_input = st.text_input(
        "MongoDB URI",
        value=st.session_state.get("mongodb_uri", ""),
        type="password",
        placeholder="mongodb+srv://username:password@cluster.mongodb.net/",
        help="Stored in session only — never saved to disk."
    )
    db_name = st.text_input(
        "Database name",
        value=st.session_state.get("mongodb_db", "bapaji_archive"),
        placeholder="bapaji_archive"
    )

    c1, _ = st.columns([1, 4])
    with c1:
        test_btn = st.button("Test Connection", type="primary")

    if test_btn and uri_input:
        with st.spinner("Testing..."):
            ok, msg = test_connection(uri_input)
        if ok:
            st.session_state["mongodb_uri"] = uri_input
            st.session_state["mongodb_db"]  = db_name or "bapaji_archive"
            from utils.db import _get_cached_client
            _get_cached_client.clear()
            st.success(f"✅ {msg} — saved for this session.")
            ensure_text_index()
        else:
            st.error(f"❌ {msg}")
    elif test_btn:
        st.warning("Enter a MongoDB URI first.")

    st.markdown("---")

    # ── NotebookLM ───────────────────────────────────────────────────────────
    st.markdown("### NotebookLM Setup")

    from utils.notebooklm_client import is_notebooklm_available
    if is_notebooklm_available():
        st.markdown("""
        <div style="display:flex;align-items:center;gap:10px;background:#061209;
                    border:1px solid rgba(61,205,139,0.18);border-radius:300px;
                    padding:8px 18px;font-family:'Martian Mono',monospace;font-size:10px;
                    color:#3DCD8B;letter-spacing:0.08em;text-transform:uppercase;width:fit-content;">
            <span style="width:6px;height:6px;border-radius:50%;background:#3DCD8B;
                         box-shadow:0 0 6px #3DCD8B;display:inline-block;"></span>
            notebooklm-py installed
        </div>""", unsafe_allow_html=True)
    else:
        st.markdown("""
        <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.07);
                    border-radius:16px;padding:1.2rem 1.4rem;">
          <div style="font-family:'Martian Mono',monospace;font-size:10px;color:#FF4C33;
                      letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
              notebooklm-py not installed
          </div>
          <div style="font-size:13px;color:#595959;font-family:'Inter',sans-serif;
                      margin-bottom:12px;line-height:1.6;">
              Run these commands in your terminal:
          </div>
          <div style="background:#000;border:1px solid rgba(255,255,255,0.07);
                      border-radius:10px;padding:12px 16px;
                      font-family:'Martian Mono',monospace;font-size:11px;
                      color:#3DCD8B;line-height:2.2;">
            pip install "notebooklm-py[browser]"<br>
            playwright install chromium<br>
            notebooklm login
          </div>
        </div>""", unsafe_allow_html=True)

    st.markdown("""
    <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.07);
                border-radius:16px;padding:1.2rem 1.4rem;margin-top:12px;">
      <div style="font-family:'Martian Mono',monospace;font-size:9px;color:#2d2d2d;
                  letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Auth Note</div>
      <div style="font-size:13px;color:#595959;font-family:'Inter',sans-serif;line-height:1.7;">
        Authenticate once via
        <code style="font-size:11px;color:#3DCD8B;background:#061209;padding:1px 8px;
                     border-radius:6px;border:1px solid rgba(61,205,139,0.18);">notebooklm login</code>
        in your terminal. Re-run if extraction fails.
      </div>
    </div>""", unsafe_allow_html=True)

    st.markdown("---")

    # ── Archive settings ──────────────────────────────────────────────────────
    st.markdown("### Archive Settings")
    default_tier = st.select_slider(
        "Default access tier for new extractions",
        options=["Tier 1 — Public", "Tier 2 — Controlled", "Tier 3 — Restricted"],
        value=st.session_state.get("default_tier_label", "Tier 1 — Public")
    )
    st.session_state["default_tier_label"] = default_tier

    st.markdown("---")

    # ── Database ──────────────────────────────────────────────────────────────
    st.markdown("### Database")
    m1, m2 = st.columns(2)
    with m1:
        if st.button("Rebuild Search Index", use_container_width=True):
            with st.spinner("Rebuilding..."):
                ensure_text_index()
            st.success("Search index rebuilt.")
    with m2:
        if st.button("Show Collection Stats", use_container_width=True):
            from utils.db import get_archive_stats
            stats = get_archive_stats()
            if stats:
                for k, v in stats.items():
                    st.markdown(f"""
                    <div style="display:flex;justify-content:space-between;padding:7px 0;
                                font-family:'Martian Mono',monospace;font-size:10px;
                                border-bottom:1px solid rgba(255,255,255,0.06);
                                letter-spacing:0.04em;">
                        <span style="color:#595959;">{k}</span>
                        <span style="color:#3DCD8B;font-weight:400;">{v:,}</span>
                    </div>""", unsafe_allow_html=True)
            else:
                st.info("No data yet or not connected.")

    st.markdown("---")

    # ── About ────────────────────────────────────────────────────────────────
    st.markdown("""
    <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.07);
                border-radius:16px;padding:1.2rem 1.6rem;
                font-family:'Martian Mono',monospace;font-size:10px;
                color:#2d2d2d;line-height:2.2;letter-spacing:0.04em;">
        <div style="color:#595959;margin-bottom:4px;">BAPAJI LIFE ARCHIVE · SRMD AV · v1.0</div>
        <div>Stack: Streamlit · notebooklm-py · MongoDB Atlas</div>
        <div>Extraction: NotebookLM → Claude-structured JSON → MongoDB</div>
    </div>""", unsafe_allow_html=True)
