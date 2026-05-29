import streamlit as st
from utils.db import get_timeline_data, query_incidents, get_db
from prompts.extraction_prompts import CATEGORY_META, get_category_color, get_category_icon
from views.browse import render_incident_card


def render():
    st.markdown("## 🕐 Chronological Timeline")

    db = get_db()
    if db is None:
        st.error("MongoDB not connected. Configure in ⚙️ Settings.")
        return

    timeline = get_timeline_data()

    if not timeline:
        st.markdown("""
        <div style="background:#1a1810;border:1px dashed #2e2920;border-radius:4px;
                    padding:4rem;text-align:center;color:#4a3e28;
                    font-family:'Cormorant Garamond',serif;font-size:18px;line-height:1.8;">
            No dated incidents in the archive yet.<br>
            <span style="font-size:14px;color:#3a3028;">
                Run an extraction to populate the timeline.
            </span>
        </div>""", unsafe_allow_html=True)
        return

    # ── Year range filter ────────────────────────────────────────────────────
    years = [item["_id"] for item in timeline if item["_id"]]
    if not years:
        st.info("No incidents with known years found.")
        return

    min_y, max_y = min(years), max(years)
    fc1, fc2, _ = st.columns([1, 1, 4])
    with fc1:
        from_y = st.number_input("From year", min_value=min_y, max_value=max_y,
                                   value=min_y, key="tl_from")
    with fc2:
        to_y = st.number_input("To year", min_value=min_y, max_value=max_y,
                                 value=max_y, key="tl_to")

    filtered = [item for item in timeline
                if item["_id"] and from_y <= item["_id"] <= to_y]

    # ── Timeline summary bar ─────────────────────────────────────────────────
    st.markdown(f"""
    <div style="font-family:'DM Mono',monospace;font-size:10px;color:#5a4e3a;margin:0.5rem 0 1.2rem;">
        {len(filtered)} years · {sum(i['count'] for i in filtered)} incidents
    </div>""", unsafe_allow_html=True)

    # ── Visual density strip ─────────────────────────────────────────────────
    if filtered:
        max_count = max(item["count"] for item in filtered) or 1
        st.markdown('<div style="display:flex;gap:2px;align-items:flex-end;height:50px;margin-bottom:1.5rem;overflow-x:auto;">', unsafe_allow_html=True)
        bars_html = '<div style="display:flex;gap:2px;align-items:flex-end;height:50px;margin-bottom:1.5rem;">'
        for item in filtered:
            h = max(4, int((item["count"] / max_count) * 46))
            cats = item.get("categories", [])
            color = get_category_color(cats[0]) if cats else "#c9a84c"
            bars_html += f'<div title="{item["_id"]}: {item["count"]} incidents" style="width:8px;height:{h}px;background:{color};border-radius:1px;opacity:0.8;flex-shrink:0;"></div>'
        bars_html += '</div>'
        st.markdown(bars_html, unsafe_allow_html=True)

    # ── Year-by-year detail ──────────────────────────────────────────────────
    for item in filtered:
        year   = item["_id"]
        count  = item["count"]
        cats   = list(set(item.get("categories", [])))
        sample = item.get("incidents", [])[:3]

        cat_pills = " ".join(
            f'<span style="font-size:9px;padding:1px 8px;border-radius:3px;'
            f'background:{get_category_color(c)}18;border:1px solid {get_category_color(c)}44;'
            f'color:{get_category_color(c)};font-family:\'DM Mono\',monospace;">'
            f'{get_category_icon(c)} {CATEGORY_META.get(c,{}).get("label",c)}</span>'
            for c in cats if c
        )

        with st.expander(f"**{year}** · {count} incident{'s' if count!=1 else ''}", expanded=False):
            if cat_pills:
                st.markdown(f'<div style="margin-bottom:10px;">{cat_pills}</div>',
                            unsafe_allow_html=True)

            # Show sample previews
            for s in sample:
                desc = s.get("desc", "")
                cat  = s.get("cat", "")
                st.markdown(f"""
                <div style="padding:6px 12px;background:#1a1810;border-left:2px solid {get_category_color(cat)};
                            border-radius:0 2px 2px 0;margin-bottom:4px;
                            font-family:'Cormorant Garamond',serif;font-size:13px;color:#c8b89a;">
                    {get_category_icon(cat)} {desc[:120]}{'…' if len(desc)>120 else ''}
                </div>""", unsafe_allow_html=True)

            if count > 3:
                st.markdown(f"""
                <div style="font-family:'DM Mono',monospace;font-size:10px;
                            color:#5a4e3a;padding:4px 0;">
                    + {count - 3} more incidents this year
                </div>""", unsafe_allow_html=True)

            # Load full incidents for this year
            if st.button(f"Show all {count} incidents from {year}", key=f"tl_load_{year}"):
                with st.spinner(f"Loading {year}..."):
                    incidents, _ = query_incidents(
                        year_from=year, year_to=year,
                        access_tier_max=3,
                        limit=100
                    )
                for inc in incidents:
                    render_incident_card(inc, expanded=True)
