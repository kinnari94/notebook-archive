import streamlit as st
from utils.db import get_db, get_archive_stats, get_category_breakdown, get_recent_extractions
from prompts.extraction_prompts import CATEGORY_META


def render():
    st.markdown("## 🪔 Archive Dashboard")

    db = get_db()
    connected = db is not None

    if connected:
        st.markdown("""
        <div style="display:flex;align-items:center;gap:10px;
                    background:#061209;border:1px solid rgba(61,205,139,0.18);
                    border-radius:300px;padding:8px 18px;margin-bottom:2rem;
                    font-family:'Martian Mono',monospace;font-size:10px;
                    color:#3DCD8B;letter-spacing:0.08em;text-transform:uppercase;
                    width:fit-content;">
            <span style="width:6px;height:6px;border-radius:50%;background:#3DCD8B;
                         box-shadow:0 0 6px #3DCD8B;display:inline-block;flex-shrink:0;"></span>
            MongoDB Atlas connected
        </div>""", unsafe_allow_html=True)
    else:
        st.markdown("""
        <div style="display:flex;align-items:center;gap:10px;
                    background:#120606;border:1px solid rgba(255,76,51,0.18);
                    border-radius:300px;padding:8px 18px;margin-bottom:2rem;
                    font-family:'Martian Mono',monospace;font-size:10px;
                    color:#FF4C33;letter-spacing:0.08em;text-transform:uppercase;
                    width:fit-content;">
            <span style="width:6px;height:6px;border-radius:50%;background:#FF4C33;
                         display:inline-block;flex-shrink:0;"></span>
            Not connected — go to ⚙️ Settings
        </div>""", unsafe_allow_html=True)
        st.info("Configure your MongoDB Atlas URI in ⚙️ Settings to get started.")
        return

    # ── Stats row ────────────────────────────────────────────────────────────
    stats = get_archive_stats()
    total_incidents = stats.get("incidents", 0)

    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        st.metric("Total Incidents", f"{total_incidents:,}")
    with c2:
        st.metric("People", stats.get("people", 0))
    with c3:
        st.metric("Extractions Run", stats.get("extractions", 0))
    with c4:
        st.metric("Seva Projects", stats.get("seva_projects", 0))
    with c5:
        st.metric("Physical Spaces", stats.get("physical_spaces", 0))

    st.markdown("<br>", unsafe_allow_html=True)

    col_left, col_right = st.columns([3, 2])

    # ── Category breakdown ───────────────────────────────────────────────────
    with col_left:
        st.markdown("### By Category")
        breakdown = get_category_breakdown()
        if breakdown:
            for item in breakdown:
                cat   = item["_id"] or "uncategorised"
                count = item["count"]
                meta  = CATEGORY_META.get(cat, {})
                color = meta.get("color", "#595959")
                icon  = meta.get("icon", "●")
                label = meta.get("label", cat)
                pct   = (count / max(total_incidents, 1)) * 100
                st.markdown(f"""
                <div style="margin-bottom:12px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:13px;color:#E7E5DD;font-family:'Inter',sans-serif;font-weight:500;">
                        {icon}&nbsp; {label}
                    </span>
                    <span style="font-family:'Martian Mono',monospace;font-size:10px;
                                 color:#595959;letter-spacing:0.06em;">{count:,}</span>
                  </div>
                  <div style="background:#111;border-radius:300px;height:3px;overflow:hidden;">
                    <div style="width:{pct:.1f}%;height:3px;background:{color};
                                border-radius:300px;"></div>
                  </div>
                </div>""", unsafe_allow_html=True)
        else:
            st.markdown("""
            <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.06);
                        border-radius:16px;padding:3rem;text-align:center;
                        color:#2d2d2d;font-family:'Space Grotesk',sans-serif;
                        font-size:16px;font-weight:600;">
                No incidents extracted yet.<br>
                <span style="font-size:13px;font-weight:400;color:#2d2d2d;">Go to ⚗️ Extract to begin.</span>
            </div>""", unsafe_allow_html=True)

    # ── Recent extraction jobs ───────────────────────────────────────────────
    with col_right:
        st.markdown("### Recent Extractions")
        jobs = get_recent_extractions(8)
        if jobs:
            for job in jobs:
                status   = job.get("status", "unknown")
                nb_title = job.get("notebook_title", job.get("notebook_id", "—"))[:32]
                cats     = job.get("categories_run", [])
                inserted = job.get("incidents_inserted", 0)
                c_map = {"done": "#3DCD8B", "running": "#2883FE", "error": "#FF4C33"}
                dot = c_map.get(status, "#FC74DD")

                st.markdown(f"""
                <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:12px 16px;margin-bottom:6px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <span style="font-size:13px;color:#fff;font-family:'Space Grotesk',sans-serif;
                                 font-weight:600;overflow:hidden;text-overflow:ellipsis;
                                 white-space:nowrap;max-width:170px;">{nb_title}</span>
                    <span style="display:flex;align-items:center;gap:5px;
                                 font-family:'Martian Mono',monospace;font-size:9px;
                                 color:{dot};letter-spacing:0.08em;text-transform:uppercase;">
                        <span style="width:5px;height:5px;border-radius:50%;
                                     background:{dot};display:inline-block;"></span>{status}
                    </span>
                  </div>
                  <div style="font-family:'Martian Mono',monospace;font-size:10px;
                               color:#2d2d2d;letter-spacing:0.04em;">
                    {len(cats)} categories · {inserted} incidents
                  </div>
                </div>""", unsafe_allow_html=True)
        else:
            st.markdown("""
            <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.06);
                        border-radius:16px;padding:3rem;text-align:center;
                        color:#2d2d2d;font-family:'Space Grotesk',sans-serif;
                        font-size:15px;font-weight:600;">
                No extraction jobs run yet.
            </div>""", unsafe_allow_html=True)

    # ── Quick actions ────────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("### Quick Actions")
    qa1, qa2, qa3, qa4 = st.columns(4)
    with qa1:
        if st.button("⚗️ Run Extraction", use_container_width=True, type="primary"):
            st.session_state["nav_override"] = "extract"
            st.rerun()
    with qa2:
        if st.button("📜 Browse Archive", use_container_width=True):
            st.session_state["nav_override"] = "browse"
            st.rerun()
    with qa3:
        if st.button("🔍 Search", use_container_width=True):
            st.session_state["nav_override"] = "search"
            st.rerun()
    with qa4:
        if st.button("⚙️ Settings", use_container_width=True):
            st.session_state["nav_override"] = "settings"
            st.rerun()
