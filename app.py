import streamlit as st

st.set_page_config(
    page_title="Bapaji Life Archive",
    page_icon="🪔",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=Martian+Mono:wght@300;400&display=swap');

:root {
    --bg:        #000000;
    --surface:   #0a0a0a;
    --surface-2: #111111;
    --surface-3: #1a1a1a;
    --border:    rgba(255,255,255,0.07);
    --border-2:  rgba(255,255,255,0.12);
    --border-3:  rgba(255,255,255,0.18);
    --green:     #3DCD8B;
    --green-g:   rgba(61,205,139,0.10);
    --pink:      #FC74DD;
    --pink-g:    rgba(252,116,221,0.10);
    --blue:      #2883FE;
    --coral:     #FF4C33;
    --light-blue:#94BCEE;
    --cream:     #E7E5DD;
    --text:      #FFFFFF;
    --text-2:    #E7E5DD;
    --text-3:    #595959;
    --text-4:    #2d2d2d;
}

/* ── Base ─────────────────────────────────────────── */
html, body {
    font-family: 'Inter', system-ui, sans-serif !important;
    background: var(--bg) !important;
    color: var(--text) !important;
    -webkit-font-smoothing: antialiased !important;
    text-rendering: optimizeLegibility !important;
}
.stApp,
[data-testid="stAppViewContainer"],
[data-testid="stMain"] {
    background: var(--bg) !important;
    font-family: 'Inter', system-ui, sans-serif !important;
    color: var(--text) !important;
}
p { color: var(--text-2); font-family: 'Inter', sans-serif; line-height: 1.7; font-size: 14px; }

/* ── Sidebar ──────────────────────────────────────── */
section[data-testid="stSidebar"] {
    background: #000 !important;
    border-right: 1px solid var(--border) !important;
}

/* Nav: hide radio circles, style as menu */
[data-testid="stSidebar"] [data-testid="stRadio"] input[type="radio"] {
    position: absolute !important;
    opacity: 0 !important;
    width: 1px !important;
    height: 1px !important;
    pointer-events: none !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] {
    display: flex !important;
    flex-direction: column !important;
    gap: 1px !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] label {
    display: flex !important;
    align-items: center !important;
    padding: 8px 14px !important;
    border-radius: 8px !important;
    margin: 0 6px !important;
    cursor: pointer !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    font-family: 'Inter', sans-serif !important;
    color: var(--text-3) !important;
    transition: all 0.12s ease !important;
    border: 1px solid transparent !important;
    letter-spacing: 0.01em !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] label:hover {
    background: var(--surface-2) !important;
    color: var(--text-2) !important;
}
[data-testid="stSidebar"] [data-testid="stRadio"] label:has(input:checked) {
    background: var(--green-g) !important;
    color: var(--green) !important;
    border: 1px solid rgba(61,205,139,0.2) !important;
    font-weight: 600 !important;
}
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span { color: var(--text-3) !important; }

/* ── Main content ─────────────────────────────────── */
[data-testid="block-container"],
.main .block-container {
    padding: 2.5rem 3rem !important;
    max-width: 1400px !important;
    background: transparent !important;
}

/* ── Typography ───────────────────────────────────── */
h1, h2, h3, h4 {
    font-family: 'Space Grotesk', system-ui, sans-serif !important;
    color: var(--text) !important;
    line-height: 1.15 !important;
    letter-spacing: -0.02em !important;
}
h1 { font-size: 3rem !important; font-weight: 700 !important; }
h2 {
    font-size: 2rem !important;
    font-weight: 700 !important;
    border-bottom: 1px solid var(--border) !important;
    padding-bottom: 0.8rem !important;
    margin-bottom: 2rem !important;
}
h3 {
    font-size: 11px !important;
    font-weight: 500 !important;
    color: var(--text-3) !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    font-family: 'Martian Mono', monospace !important;
    margin-top: 2rem !important;
    margin-bottom: 1rem !important;
}

/* ── Widget labels ────────────────────────────────── */
label,
[data-testid="stWidgetLabel"] p,
[data-testid="stWidgetLabel"] label,
.stTextInput > label, .stTextArea > label, .stSelectbox > label,
.stNumberInput > label, .stSelectSlider > label, .stRadio > label,
.stMultiSelect > label, .stCheckbox > label, .stSlider > label {
    color: var(--text-3) !important;
    font-family: 'Martian Mono', monospace !important;
    font-size: 10px !important;
    font-weight: 400 !important;
    letter-spacing: 0.1em !important;
    text-transform: uppercase !important;
}
[data-testid="stCaptionContainer"] p { color: var(--text-3) !important; font-size: 11px !important; font-family: 'Martian Mono', monospace !important; letter-spacing: 0.04em !important; }

/* ── Buttons — pill-shaped like datalands ─────────── */
.stButton > button {
    background: transparent !important;
    border: 1px solid var(--border-2) !important;
    color: var(--text-2) !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    padding: 0.45rem 1.4rem !important;
    border-radius: 300px !important;
    transition: all 0.15s ease !important;
    letter-spacing: 0.01em !important;
}
.stButton > button:hover {
    background: var(--surface-2) !important;
    border-color: var(--border-3) !important;
    color: var(--text) !important;
}
.stButton > button[kind="primary"] {
    background: var(--green) !important;
    border-color: var(--green) !important;
    color: #000 !important;
    font-weight: 600 !important;
}
.stButton > button[kind="primary"]:hover {
    background: #2fb87a !important;
    border-color: #2fb87a !important;
    color: #000 !important;
}

/* ── Text inputs ──────────────────────────────────── */
.stTextInput input, .stTextArea textarea,
[data-testid="stTextInput"] input, [data-testid="stTextArea"] textarea,
[data-baseweb="input"] input, [data-testid="stNumberInput"] input {
    background: var(--surface) !important;
    border: 1px solid var(--border-2) !important;
    color: var(--text) !important;
    border-radius: 10px !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    transition: border-color 0.15s !important;
}
[data-baseweb="input"] {
    background: var(--surface) !important;
    border: 1px solid var(--border-2) !important;
    border-radius: 10px !important;
}

/* ── Selectbox / Dropdown ─────────────────────────── */
[data-baseweb="select"] > div {
    background: var(--surface) !important;
    border: 1px solid var(--border-2) !important;
    color: var(--text) !important;
    border-radius: 10px !important;
}
[data-baseweb="popover"], [data-baseweb="menu"] {
    background: var(--surface-2) !important;
    border: 1px solid var(--border-2) !important;
    border-radius: 12px !important;
    box-shadow: 0 16px 48px rgba(0,0,0,0.8) !important;
}
[data-baseweb="option"] {
    background: var(--surface-2) !important;
    color: var(--text-2) !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
}
[data-baseweb="option"]:hover,
[data-baseweb="option"][aria-selected="true"] {
    background: var(--surface-3) !important;
    color: var(--text) !important;
}

/* Multiselect tags */
.stMultiSelect [data-baseweb="tag"] {
    background: var(--green-g) !important;
    border: 1px solid rgba(61,205,139,0.25) !important;
    color: var(--green) !important;
    border-radius: 300px !important;
    font-family: 'Martian Mono', monospace !important;
    font-size: 10px !important;
}

/* Checkbox */
[data-testid="stCheckbox"] label {
    color: var(--text-2) !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    text-transform: none !important;
    letter-spacing: normal !important;
}

/* ── Metrics ──────────────────────────────────────── */
[data-testid="stMetric"] {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: 16px !important;
    padding: 1.4rem 1.6rem !important;
    transition: border-color 0.2s !important;
}
[data-testid="stMetric"]:hover { border-color: var(--border-2) !important; }
[data-testid="stMetricLabel"] {
    color: var(--text-3) !important;
    font-size: 10px !important;
    font-family: 'Martian Mono', monospace !important;
    letter-spacing: 0.1em !important;
    text-transform: uppercase !important;
    font-weight: 400 !important;
}
[data-testid="stMetricValue"] {
    color: var(--text) !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 2.6rem !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    letter-spacing: -0.03em !important;
}

/* ── Expanders ────────────────────────────────────── */
[data-testid="stExpander"] details summary,
[data-testid="stExpander"] summary {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: 12px !important;
    color: var(--text-2) !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    padding: 12px 18px !important;
    transition: border-color 0.15s !important;
}
[data-testid="stExpander"] details summary:hover { border-color: var(--border-2) !important; }
[data-testid="stExpander"] details[open] summary {
    border-radius: 12px 12px 0 0 !important;
    border-bottom-color: transparent !important;
}
[data-testid="stExpander"] details > div {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-top: none !important;
    border-radius: 0 0 12px 12px !important;
    padding: 1.2rem 1.4rem !important;
}

/* ── Progress / Dividers / Misc ───────────────────── */
.stProgress > div > div, [role="progressbar"] > div {
    background: var(--green) !important;
    border-radius: 300px !important;
}
.stProgress > div { background: var(--surface-2) !important; border-radius: 300px !important; }
hr { border-color: var(--border) !important; opacity: 1 !important; margin: 2rem 0 !important; }
.stAlert { border-radius: 12px !important; font-family: 'Inter', sans-serif !important; }
[data-testid="stDataFrame"] { border: 1px solid var(--border) !important; border-radius: 12px !important; }
[data-testid="stHeader"] { background: #000 !important; border-bottom: 1px solid var(--border) !important; }
[data-testid="stToolbar"] { display: none !important; }
[data-testid="stSpinner"] p { color: var(--text-3) !important; font-family: 'Martian Mono', monospace !important; font-size: 11px !important; }

/* ── Badges ───────────────────────────────────────── */
.badge {
    display: inline-block; padding: 2px 10px; border-radius: 300px;
    font-size: 10px; font-family: 'Martian Mono', monospace;
    letter-spacing: 0.04em; font-weight: 400; margin: 2px;
}
.badge-gold   { background: rgba(252,116,221,0.08); border: 1px solid rgba(252,116,221,0.2); color: var(--pink); }
.badge-teal   { background: rgba(61,205,139,0.08); border: 1px solid rgba(61,205,139,0.2); color: var(--green); }
.badge-coral  { background: rgba(255,76,51,0.08); border: 1px solid rgba(255,76,51,0.2); color: var(--coral); }
.badge-violet { background: rgba(148,188,238,0.08); border: 1px solid rgba(148,188,238,0.2); color: var(--light-blue); }
.badge-green  { background: rgba(61,205,139,0.08); border: 1px solid rgba(61,205,139,0.2); color: var(--green); }
.badge-muted  { background: var(--surface-2); border: 1px solid var(--border); color: var(--text-3); }

/* ── Tier badges ──────────────────────────────────── */
.tier-1 { background: rgba(61,205,139,0.08); border: 1px solid rgba(61,205,139,0.2); color: var(--green); font-size: 9px; padding: 2px 10px; border-radius: 300px; font-family: 'Martian Mono',monospace; font-weight: 400; letter-spacing: 0.06em; }
.tier-2 { background: rgba(252,116,221,0.08); border: 1px solid rgba(252,116,221,0.2); color: var(--pink); font-size: 9px; padding: 2px 10px; border-radius: 300px; font-family: 'Martian Mono',monospace; font-weight: 400; letter-spacing: 0.06em; }
.tier-3 { background: rgba(255,76,51,0.08); border: 1px solid rgba(255,76,51,0.2); color: var(--coral); font-size: 9px; padding: 2px 10px; border-radius: 300px; font-family: 'Martian Mono',monospace; font-weight: 400; letter-spacing: 0.06em; }

/* ── Incident cards ───────────────────────────────── */
.incident-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 2px solid var(--green);
    border-radius: 14px;
    padding: 1.2rem 1.5rem;
    margin-bottom: 8px;
    transition: border-color 0.15s, background 0.15s;
}
.incident-card:hover { border-color: var(--border-2); background: var(--surface-2); }
.incident-card .ic-date { font-family: 'Martian Mono',monospace; font-size: 10px; color: var(--text-3); letter-spacing: 0.1em; margin-bottom: 6px; font-weight: 400; text-transform: uppercase; }
.incident-card .ic-desc { font-family: 'Space Grotesk',sans-serif; font-size: 15px; line-height: 1.55; color: var(--text); font-weight: 600; }
.incident-card .ic-chunk { font-family: 'Inter',sans-serif; font-style: italic; font-size: 13px; color: var(--text-3); border-left: 1px solid var(--border-2); padding-left: 14px; margin-top: 12px; line-height: 1.7; }

/* Category left borders */
.cat-historicity   { border-left-color: #FC74DD !important; }
.cat-health        { border-left-color: #FF4C33 !important; }
.cat-spiritual     { border-left-color: #94BCEE !important; }
.cat-institutional { border-left-color: #3DCD8B !important; }
.cat-seva          { border-left-color: #3DCD8B !important; }
.cat-people        { border-left-color: #FC74DD !important; }
.cat-spaces        { border-left-color: #2883FE !important; }
.cat-awards        { border-left-color: #FF4C33 !important; }
.cat-contextual    { border-left-color: #94BCEE !important; }

/* ── Chunk / Log / Status ─────────────────────────── */
.chunk-box {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.2rem;
    font-family: 'Inter', sans-serif;
    font-style: italic;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-3);
    max-height: 200px;
    overflow-y: auto;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 7px; }
.status-pending { background: var(--pink); }
.status-running { background: var(--blue); animation: pulse 1.2s infinite; }
.status-done    { background: var(--green); }
.status-error   { background: var(--coral); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }

.log-console {
    background: #000;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    font-family: 'Martian Mono', monospace;
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.9;
    max-height: 300px;
    overflow-y: auto;
}
.log-ok   { color: var(--green); }
.log-info { color: var(--blue); }
.log-warn { color: var(--pink); }
.log-err  { color: var(--coral); }

/* ── Scrollbar ────────────────────────────────────── */
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 300px; }
</style>
""", unsafe_allow_html=True)

# ── Navigation ───────────────────────────────────────────────────────────────
PAGES = [
    "🏠  Dashboard",
    "⚗️  Extract",
    "📜  Browse Archive",
    "🔍  Search",
    "🕐  Timeline",
    "⚙️  Settings",
]
_NAV_MAP = {
    "dashboard": 0, "extract": 1, "browse": 2,
    "search": 3, "timeline": 4, "settings": 5,
}

with st.sidebar:
    st.markdown("""
    <div style="padding:2rem 1.2rem 1.2rem;">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:1.5rem;font-weight:700;
                    color:#fff;line-height:1.1;letter-spacing:-0.02em;">Bapaji<br>Life Archive</div>
        <div style="font-family:'Martian Mono',monospace;font-size:9px;color:#2d2d2d;
                    letter-spacing:0.18em;margin-top:12px;text-transform:uppercase;">SRMD AV · v1.0</div>
    </div>
    <div style="height:1px;background:rgba(255,255,255,0.06);margin:0 0 0.8rem;"></div>
    """, unsafe_allow_html=True)

    if "nav_override" in st.session_state:
        override = st.session_state.pop("nav_override")
        st.session_state["_nav_radio"] = PAGES[_NAV_MAP.get(override, 0)]

    page = st.radio("Navigate", PAGES, key="_nav_radio", label_visibility="collapsed")

# ── Auto-connect & index setup ────────────────────────────────────────────────
from utils.db import ensure_text_index
ensure_text_index()

# ── Route pages ───────────────────────────────────────────────────────────────
if "🏠" in page:
    from views.dashboard import render
    render()
elif "⚗️" in page:
    from views.extract import render
    render()
elif "📜" in page:
    from views.browse import render
    render()
elif "🔍" in page:
    from views.search import render
    render()
elif "🕐" in page:
    from views.timeline import render
    render()
elif "⚙️" in page:
    from views.settings import render
    render()
