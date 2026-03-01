# utils/agent_helpers.py
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def generate_session_id(prefix: str, obj: object) -> str:
    """根據前綴和物件生成唯一的 session ID"""
    return f"{prefix}-{id(obj)}"


def build_initial_state(
    messages: list,
    prediction_results: Optional[Dict[str, Any]] = None,
    additional_info: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    memory_context: Optional[str] = None,
    image_path: Optional[str] = None,
) -> Dict[str, Any]:
    """建構 agent 的初始狀態字典"""
    state: Dict[str, Any] = {
        "messages": messages,
        "prediction_results": prediction_results,
        "additional_info": additional_info,
        "analysis_stage": "initial",
        "final_response": None,
    }
    if user_id is not None:
        state["user_id"] = user_id
    if session_id is not None:
        state["session_id"] = session_id
    if memory_context is not None:
        state["memory_context"] = memory_context
    if image_path is not None:
        state["image_path"] = image_path
    return state


def create_agent_config(thread_id: str) -> Dict[str, Any]:
    """建立 LangGraph agent 的 config 字典"""
    return {"configurable": {"thread_id": thread_id}}


def extract_response_text(result: Dict[str, Any]) -> str:
    """從 agent 結果中提取回應文字"""
    response_text = result.get("final_response", "")
    if not response_text:
        messages = result.get("messages", [])
        if messages:
            last_message = messages[-1]
            response_text = (
                last_message.content
                if hasattr(last_message, "content")
                else str(last_message)
            )
    return response_text


async def cleanup_temp_file(path: Optional[str]) -> None:
    """安全清除暫存檔"""
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except Exception as e:
            logger.warning(f"清除暫存檔失敗 ({path}): {e}")
