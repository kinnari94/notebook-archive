"""
NotebookLM integration using notebooklm-py library.
Handles notebook listing, chat queries, and response streaming.
"""

import asyncio
import streamlit as st
from typing import Optional, Callable


def is_notebooklm_available() -> bool:
    try:
        import notebooklm  # noqa: F401
        return True
    except ImportError:
        return False


async def _list_notebooks_async() -> list[dict]:
    from notebooklm import NotebookLMClient
    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        return [
            {
                "id": nb.id,
                "title": getattr(nb, "title", nb.id),
                "source_count": getattr(nb, "source_count", 0),
            }
            for nb in notebooks
        ]


def list_notebooks() -> tuple[list[dict], Optional[str]]:
    """Return (notebooks, error_message)."""
    if not is_notebooklm_available():
        return [], "notebooklm-py not installed. Run: pip install 'notebooklm-py[browser]'"
    try:
        notebooks = asyncio.run(_list_notebooks_async())
        return notebooks, None
    except Exception as e:
        msg = str(e)
        if "auth" in msg.lower() or "login" in msg.lower() or "storage" in msg.lower():
            return [], "Not authenticated. Run: notebooklm login"
        return [], f"Error listing notebooks: {msg}"


async def _ask_async(notebook_id: str, prompt: str) -> str:
    from notebooklm import NotebookLMClient
    async with await NotebookLMClient.from_storage() as client:
        result = await client.chat.ask(notebook_id, prompt)
        return result.answer


def ask_notebook(
    notebook_id: str,
    prompt: str,
    progress_cb: Optional[Callable[[str], None]] = None,
) -> tuple[str, Optional[str]]:
    """
    Send a prompt to a NotebookLM notebook.
    Returns (answer_text, error_message).
    """
    if not is_notebooklm_available():
        return "", "notebooklm-py not installed"
    try:
        if progress_cb:
            progress_cb(f"Querying notebook {notebook_id[:8]}...")
        answer = asyncio.run(_ask_async(notebook_id, prompt))
        return answer, None
    except Exception as e:
        return "", str(e)


async def _get_sources_async(notebook_id: str) -> list[dict]:
    from notebooklm import NotebookLMClient
    async with await NotebookLMClient.from_storage() as client:
        sources = await client.sources.list(notebook_id)
        return [
            {
                "id": s.id,
                "title": getattr(s, "title", s.id),
                "type": getattr(s, "source_type", "unknown"),
            }
            for s in sources
        ]


def get_notebook_sources(notebook_id: str) -> tuple[list[dict], Optional[str]]:
    if not is_notebooklm_available():
        return [], "notebooklm-py not installed"
    try:
        sources = asyncio.run(_get_sources_async(notebook_id))
        return sources, None
    except Exception as e:
        return [], str(e)
