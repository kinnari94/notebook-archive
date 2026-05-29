import streamlit as st
from utils.db import query_incidents, get_all_people, get_all_locations, get_db
from prompts.extraction_prompts import CATEGORY_META, get_category_color, get_category_icon, get_all_categories


def render():
    st.markdown("## 📜 Browse Archive")

    db = get_db()
    if db is None:
        st.error("MongoDB not connected. Configure in ⚙️ Settings.")
        return

    # ── Filters sidebar panel ────────────────────────────────────────────────
    with st.expander("🔽 Filters", expanded=True):
        fc1, fc2, fc3 = st.columns(3)

        with fc1:
            all_cats = ["All categories"] + [
                f"{CATEGORY_META.get(c,{}).get('icon','●')} {CATEGORY_META.get(c,{}).get('label',c)}"
                for c in get_all_categories()
            ]
            cat_choice = st.selectbox("Category", all_cats)
            category = None
            if cat_choice != "All categories":
                # Reverse lookup
                for c in get_all_categories():
                    label = f"{CATEGORY_META.get(c,{}).get('icon','●')} {CATEGORY_META.get(c,{}).get('label',c)}"
                    if label == cat_choice:
                        category = c
                        break

        with fc2:
            people_list = [""] + get_all_people(200)
            person = st.selectbox("Person mentioned", people_list)
            person = person or None

        with fc3:
            locations_list = [""] + get_all_locations(200)
            location = st.selectbox("Location", locations_list)
            location = location or None

        yr1, yr2, tier_col = st.columns(3)
        with yr1:
            year_from = st.number_input("Year from", min_value=1900, max_value=2030,
                                         value=None, placeholder="e.g. 1960")
        with yr2:
            year_to = st.number_input("Year to", min_value=1900, max_value=2030,
                                       value=None, placeholder="e.g. 2020")
        with tier_col:
            tier_labels = {1: "🟢 Tier 1 — Public", 2: "🟡 Tier 2 — Controlled", 3: "🔴 Tier 3 — All"}
            tier_sel = st.selectbox("Access tier", list(tier_labels.values()))
            tier_map = {v: k for k, v in tier_labels.items()}
            access_tier_max = tier_map[tier_sel]

    # ── Query ────────────────────────────────────────────────────────────────
    PAGE_SIZE = 20
    if "browse_page" not in st.session_state:
        st.session_state["browse_page"] = 0

    incidents, total = query_incidents(
        category=category,
        person=person,
        location=location,
        year_from=int(year_from) if year_from else None,
        year_to=int(year_to) if year_to else None,
        access_tier_max=access_tier_max,
        limit=PAGE_SIZE,
        skip=st.session_state["browse_page"] * PAGE_SIZE,
    )

    # ── Results header ───────────────────────────────────────────────────────
    st.markdown(f"""
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:#5a4e3a;">
            {total:,} incidents found
        </span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:#3a3028;">
            page {st.session_state['browse_page']+1} of {max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)}
        </span>
    </div>""", unsafe_allow_html=True)

    if not incidents:
        st.markdown("""
        <div style="background:#1a1810;border:1px dashed #2e2920;border-radius:4px;padding:3rem;
                    text-align:center;color:#4a3e28;font-family:'Cormorant Garamond',serif;font-size:16px;">
            No incidents match these filters.<br>
            <span style="font-size:13px;color:#3a3028;">Try broadening your search or run an extraction first.</span>
        </div>""", unsafe_allow_html=True)
        return

    # ── Incident cards ───────────────────────────────────────────────────────
    for inc in incidents:
        render_incident_card(inc)

    # ── Pagination ───────────────────────────────────────────────────────────
    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    if total_pages > 1:
        pg1, pg2, pg3 = st.columns([1, 3, 1])
        with pg1:
            if st.button("← Previous", disabled=st.session_state["browse_page"] == 0):
                st.session_state["browse_page"] -= 1
                st.rerun()
        with pg3:
            if st.button("Next →", disabled=st.session_state["browse_page"] >= total_pages - 1):
                st.session_state["browse_page"] += 1
                st.rerun()


def render_incident_card(inc: dict, expanded: bool = False):
    """Render a single incident card."""
    cat   = inc.get("category", "")
    color = get_category_color(cat)
    icon  = get_category_icon(cat)
    meta  = CATEGORY_META.get(cat, {})

    date_obj = inc.get("date", {}) or {}
    year     = date_obj.get("year", "")
    period   = date_obj.get("period", "")
    prec     = date_obj.get("precision", "")
    date_str = f"{year}" if year else period or "Date unknown"
    if prec and prec not in ("exact", "unknown") and year:
        date_str = f"~{date_str}"

    people    = inc.get("people", [])
    locations = inc.get("locations", [])
    tier      = inc.get("access_tier", 1)
    chunk     = inc.get("source_chunk", "")
    nb_title  = inc.get("source_title", "")
    desc      = inc.get("description", "")

    tier_badge = {1: '<span class="tier-1">TIER 1</span>',
                  2: '<span class="tier-2">TIER 2</span>',
                  3: '<span class="tier-3">TIER 3</span>'}.get(tier, "")

    people_html = " ".join(
        f'<span class="badge badge-violet">{p}</span>' for p in people[:5]
    ) if people else ""
    loc_html = " ".join(
        f'<span class="badge badge-teal">{l}</span>' for l in locations[:4]
    ) if locations else ""

    with st.expander(f"{icon} {date_str}  ·  {desc[:90]}{'…' if len(desc)>90 else ''}", expanded=expanded):
        st.markdown(f"""
        <div style="margin-bottom:10px;">
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:{color};
                         background:{color}18;border:1px solid {color}44;border-radius:3px;
                         padding:2px 10px;margin-right:6px;">
                {icon} {meta.get('label', cat)}
            </span>
            {tier_badge}
        </div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:16px;line-height:1.6;
                    color:#e8dcc8;margin-bottom:10px;">
            {desc}
        </div>
        """, unsafe_allow_html=True)

        if people_html or loc_html:
            st.markdown(f"""
            <div style="margin-bottom:10px;">
                {people_html} {loc_html}
            </div>""", unsafe_allow_html=True)

        if chunk:
            st.markdown(f"""
            <div class="chunk-box">"{chunk}"</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:#3a3028;
                        margin-top:4px;padding-left:2px;">
                Source: {nb_title or 'NotebookLM transcript'}
            </div>""", unsafe_allow_html=True)

        # Metadata row
        inc_id = inc.get("_id", "")
        extracted = str(inc.get("extracted_at", ""))[:10]
        verified  = "✓ Verified" if inc.get("verified") else "○ Auto-extracted"

        st.markdown(f"""
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #1e1a12;
                    font-family:'DM Mono',monospace;font-size:9px;color:#3a3028;
                    display:flex;gap:16px;flex-wrap:wrap;">
            <span>ID: {str(inc_id)[:16]}…</span>
            <span>Extracted: {extracted}</span>
            <span>{verified}</span>
        </div>""", unsafe_allow_html=True)
