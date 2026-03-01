# agents/message_helpers.py
from typing import Optional

from langchain_core.messages import SystemMessage


def build_system_message(
    base_prompt: str,
    memory_context: Optional[str] = None,
) -> SystemMessage:
    """
    建構系統訊息，選擇性地附加記憶上下文。

    Args:
        base_prompt: 基礎系統提示詞
        memory_context: 從長期記憶中檢索的使用者歷史資料（可選）

    Returns:
        組合後的 SystemMessage
    """
    content = base_prompt
    if memory_context:
        content += (
            f"\n\n===== 以下是關於用戶的歷史資料 =====\n"
            f"{memory_context}\n"
            f"===== 用戶資料結束 ====="
        )
    return SystemMessage(content=content)
