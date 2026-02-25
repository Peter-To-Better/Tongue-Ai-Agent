from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
from ultralytics import YOLO
from config.settings import settings

import cv2
import numpy as np
import os


router = APIRouter()


class BoxResult(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    status: str       # CENTER_IT / TOO_CLOSE / TOO_FAR / GOOD / BAD_AR
    ratio: float
    aspect_ratio: float
    touching_edge: bool


class FrameResult(BaseModel):
    ok: bool                  # 是否有至少一個 GOOD 的框
    reason: str               # "ok" / "no_tongue" / "not_centered" / "too_close" / "too_far" / "bad_aspect"
    boxes: List[BoxResult]


# 與你原本 OpenCV 腳本一致的主要參數（可視需要再調整）
CONF_THRESHOLD = 0.7
SIZE_MIN = 0.10
SIZE_MAX = 0.70
AR_MIN = 0.6
AR_MAX = 1.6
MARGIN = 15


def _load_yolo_model() -> YOLO:
    """
    載入 YOLO 模型：
    - 預設從 vision-predict 目錄底下讀取 settings.tongue_detector_model_name
    - 如果找不到或檔案異常，退回使用官方預訓練的 yolov8n.pt
    """
    model_path = settings.vision_predict_path / settings.tongue_detector_model_name
    abs_path = os.path.abspath(model_path)

    # 先嘗試載入自訂模型（如果存在而且檔案大小 > 0）
    if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
        try:
            print(f"[realtime] 使用自訂 YOLO 模型：{abs_path}")
            return YOLO(str(model_path))
        except Exception as e:
            # 若自訂模型壞掉或不是 YOLO 格式，記錄錯誤並退回官方模型
            print(f"[realtime] 載入自訂 YOLO 模型失敗：{e}，將改用 yolov8n.pt")
    
    # 走到這裡代表：沒有自訂模型檔、檔案大小為 0、或載入失敗
    print("[realtime] 找不到有效的自訂模型，改用預設 yolov8n.pt")
    return YOLO("yolov8n.pt")


_yolo_model: YOLO | None = None


def _get_yolo_model() -> YOLO:
    global _yolo_model
    if _yolo_model is None:
        _yolo_model = _load_yolo_model()
    return _yolo_model


@router.post("/realtime/analyze-frame", response_model=FrameResult)
async def analyze_frame(file: UploadFile = File(...)):
    """
    單張 frame 判斷：是否有舌頭、是否置中、距離是否合適。
    給 Electron 使用：每次從攝影機抓一張 frame 丟進來，就回傳方框與狀態。
    """
    try:
        data = await file.read()
        arr = np.frombuffer(data, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="無法解析圖片資料")

        # 若之後需要鏡像，可在這裡調整；目前先使用原始方向
        frame_h, frame_w = frame.shape[:2]
        frame_area = frame_h * frame_w

        model = _get_yolo_model()
        results = model.predict(frame, verbose=False, conf=CONF_THRESHOLD)

        boxes_out: List[BoxResult] = []
        is_good_frame = False
        reason = "no_tongue"

        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(frame_w, x2), min(frame_h, y2)

                touching_edge = (
                    x1 < MARGIN or y1 < MARGIN
                    or x2 > frame_w - MARGIN
                    or y2 > frame_h - MARGIN
                )

                w, h = x2 - x1, y2 - y1
                if w <= 0 or h <= 0:
                    continue

                box_area = w * h
                ratio = box_area / frame_area
                aspect_ratio = w / h if h > 0 else 0.0

                status = "GOOD"

                if touching_edge:
                    status = "CENTER_IT"
                    # 若有任一框不在中心，就優先回報 not_centered
                    if reason == "no_tongue":
                        reason = "not_centered"
                elif aspect_ratio < AR_MIN or aspect_ratio > AR_MAX:
                    status = "BAD_AR"
                    if reason in ("no_tongue", "ok"):
                        reason = "bad_aspect"
                elif ratio > SIZE_MAX:
                    status = "TOO_CLOSE"
                    if reason in ("no_tongue", "ok"):
                        reason = "too_close"
                elif ratio < SIZE_MIN:
                    status = "TOO_FAR"
                    if reason in ("no_tongue", "ok"):
                        reason = "too_far"
                else:
                    # 尺寸、比例、位置都合格
                    is_good_frame = True
                    reason = "ok"

                boxes_out.append(BoxResult(
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    status=status,
                    ratio=ratio,
                    aspect_ratio=aspect_ratio,
                    touching_edge=touching_edge,
                ))

        return FrameResult(
            ok=is_good_frame,
            reason=reason,
            boxes=boxes_out,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析過程發生錯誤: {e}")

