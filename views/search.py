import streamlit as st
from utils.db import query_incidents, ensure_text_index, get_db
from views.browse import render_incident_card


def render():
    st.markdown("## 🔍 Search Archive")

    db = get_db()
    if db is None:
        st.error("MongoDB not connected. Configure in ⚙️ Settings.")
        return

    ensure_text_index()

    # ── Search bar ───────────────────────────────────────────────────────────
    st.markdown("""
    <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;
                color:#7a7060;margin-bottom:1rem;">
        Search across all incident descriptions, transcript chunks, and people mentions.
    </div>""", unsafe_allow_html=True)

    search_col, btn_col = st.columns([5, 1])
    with search_col:
        query = st.text_input(
            "Search",
            placeholder="e.g.  maun  ·  Morbi floods  ·  first diksha  ·  Rajkot ashram",
            label_visibility="collapsed",
        )
    with btn_col:
        search_btn = st.button("Search", type="primary", use_container_width=True)

    # ── Example queries ──────────────────────────────────────────────────────
    st.markdown("""
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1.2rem;">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:#3a3028;">Try:</span>
    """, unsafe_allow_html=True)

    examples = ["maun vrat", "flood relief", "first satsang", "Dharampur", "diksha", "COVID lockdown"]
    ex_cols = st.columns(len(examples))
    for i, ex in enumerate(examples):
        with ex_cols[i]:
            if st.button(ex, key=f"ex_{i}"):
                st.session_state["search_query"] = ex
                st.rerun()

    # Use session state query if set by example click
    if "search_query" in st.session_state and not query:
        query = st.session_state.pop("search_query")

    # ── Filters ──────────────────────────────────────────────────────────────
    with st.expander("Advanced Filters", expanded=False):
        af1, af2, af3 = st.columns(3)
        with af1:
            yr_from = st.number_input("Year from", min_value=1900, max_value=2030,
                                       value=None, placeholder="1960", key="s_yr1")
        with af2:
            yr_to = st.number_input("Year to", min_value=1900, max_value=2030,
                                     value=None, placeholder="2024", key="s_yr2")
        with af3:
            tier_labels = {1: "🟢 Tier 1 — Public", 2: "🟡 Tier 2 — Controlled", 3: "🔴 All Tiers"}
            tier_sel = st.selectbox("Access tier", list(tier_labels.values()), key="s_tier")
            tier_map = {v: k for k, v in tier_labels.items()}
            access_tier_max = tier_map[tier_sel]

    # ── Run search ───────────────────────────────────────────────────────────
    if query or search_btn:
        if not query:
            st.warning("Enter a search term.")
            return

        with st.spinner("Searching..."):
            incidents, total = query_incidents(
                search_text=query.strip(),
                year_from=int(yr_from) if yr_from else None,
                year_to=int(yr_to) if yr_to else None,
                access_tier_max=access_tier_max,
                limit=30,
            )

        st.markdown(f"""
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:#5a4e3a;margin:1rem 0 0.8rem;">
            {total} results for "{query}"
        </div>""", unsafe_allow_html=True)

        if not incidents:
            st.markdown("""
            <div style="background:#1a1810;border:1px dashed #2e2920;border-radius:4px;
                        padding:2.5rem;text-align:center;color:#4a3e28;
                        font-family:'Cormorant Garamond',serif;font-size:16px;">
                No incidents found for this search.<br>
                <span style="font-size:13px;color:#3a3028;">
                    Try different keywords, or run more extractions to grow the archive.
                </span>
            </div>""", unsafe_allow_html=True)
            return

        for inc in incidents:
            render_incident_card(inc)

    else:
        # Empty state
        st.markdown("""
        <div style="background:#1a1810;border:1px dashed #2e2920;border-radius:4px;
                    padding:4rem;text-align:center;color:#4a3e28;
                    font-family:'Cormorant Garamond',serif;font-size:18px;line-height:1.8;">
            Search Bapaji's life archive<br>
            <span style="font-size:14px;color:#3a3028;">
                Every extracted incident, teaching, journey, and encounter is searchable here.
            </span>
        </div>""", unsafe_allow_html=True)
