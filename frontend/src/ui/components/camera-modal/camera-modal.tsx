import { useRef, useEffect, useState } from "react";
import { analyzeRealtimeFrame } from "../../../api/api";
import type { RealtimeFrameResult } from "../../../api/api";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

const CameraModal = ({ isOpen, onClose, onCapture }: CameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimerRef = useRef<number | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const goodStartTimeRef = useRef<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("請將舌頭對準鏡頭，系統會自動偵測最佳畫面");

  const GOOD_HOLD_SECONDS = 1.5; // 持續幾秒偵測良好後自動截圖

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
      setStatusText("請將舌頭對準鏡頭，系統會自動偵測最佳畫面");
      goodStartTimeRef.current = null;
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const scheduleDetection = () => {
    if (detectTimerRef.current !== null) {
      window.clearTimeout(detectTimerRef.current);
    }
    // 縮短輪詢間隔以降低延遲（約 100ms）
    detectTimerRef.current = window.setTimeout(runRealtimeDetection, 100);
  };

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        // 等影片準備好後啟動即時偵測迴圈
        videoRef.current.onloadedmetadata = () => {
          if (isOpen) {
            scheduleDetection();
          }
        };
      }
    } catch (err: any) {
      console.error("無法訪問攝像頭:", err);
      
      let errorMessage = "無法訪問攝像頭。";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMessage = "攝像頭權限被拒絕。請在系統設置中允許應用訪問攝像頭。";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "未找到攝像頭設備。請確保攝像頭已連接並正常工作。";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage = "攝像頭無法讀取。可能被其他應用程序佔用。";
      } else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            streamRef.current = fallbackStream;
          }
          return;
        } catch (fallbackErr) {
          errorMessage = '無法訪問攝像頭。請檢查設備連接和權限設置。';
        }
      }
      
      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (detectTimerRef.current !== null) {
      window.clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 清除疊加框
    const canvas = overlayCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const autoCaptureAndUse = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
    onCapture(imageDataUrl);
    onClose();
  };

  const drawOverlay = (result: RealtimeFrameResult) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;

    // 確保 canvas 尺寸與 video 畫面一致
    const vw = video.videoWidth || video.clientWidth;
    const vh = video.videoHeight || video.clientHeight;
    if (!vw || !vh) return;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    result.boxes.forEach((b) => {
      let color = "#888888";
      if (b.status === "GOOD") color = "#22c55e"; // 綠色
      else if (b.status === "TOO_CLOSE" || b.status === "TOO_FAR" || b.status === "CENTER_IT") color = "#ef4444"; // 紅色
      else if (b.status === "BAD_AR") color = "#eab308"; // 黃色

      ctx.strokeStyle = color;
      ctx.lineWidth = 8; // 再加粗框線讓輪廓更明顯
      ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);

      // 簡單標籤
      const label = b.status;
      ctx.font = "14px sans-serif";
      ctx.fillStyle = color;
      const textX = b.x1 + 4;
      const textY = Math.max(16, b.y1 - 4);
      ctx.fillText(label, textX, textY);
    });
  };

  const runRealtimeDetection = async () => {
    if (!isOpen || !videoRef.current || capturedImage || error) {
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.drawImage(videoRef.current, 0, 0);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7)
      );
      if (!blob) {
        return;
      }

      const result = await analyzeRealtimeFrame(blob);

      if (result.ok) {
        const now = Date.now();
        const start = goodStartTimeRef.current ?? now;
        const elapsedSec = (now - start) / 1000;
        const remainSec = Math.max(0, GOOD_HOLD_SECONDS - elapsedSec);

        goodStartTimeRef.current = start;
        setStatusText(
          remainSec > 0
            ? `偵測良好，請保持不動... (${remainSec.toFixed(1)} 秒)`
            : "偵測良好，正在拍攝..."
        );

        if (elapsedSec >= GOOD_HOLD_SECONDS) {
          autoCaptureAndUse();
          return;
        }
      } else {
        goodStartTimeRef.current = null;
        switch (result.reason) {
          case "no_tongue":
            setStatusText("未偵測到舌頭，請張嘴並伸出舌頭對準鏡頭");
            break;
          case "not_centered":
            setStatusText("舌頭不在畫面中央，請稍微調整位置");
            break;
          case "too_close":
            setStatusText("太近了，請往後一點");
            break;
          case "too_far":
            setStatusText("太遠了，請靠近一點");
            break;
          case "bad_aspect":
            setStatusText("角度不佳，請調整頭部或鏡頭角度");
            break;
          default:
            setStatusText("正在調整中，請稍候...");
        }
      }

      // 畫出方框
      drawOverlay(result);
    } catch (e) {
      console.error("即時偵測發生錯誤:", e);
      setStatusText("即時偵測發生錯誤，請稍後重試或改用手動上傳");
    } finally {
      if (isOpen && !capturedImage) {
        scheduleDetection();
      }
    }
  };

  const handleCapture = () => {
    // 保留手動拍攝作為備援，但一般情況下不需要按這個按鈕
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(imageDataUrl);
        stopCamera();
      }
    }
  };

  const handleUsePhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[1000] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-[90%] max-w-[600px] max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center py-5 px-6 border-b border-gray-200">
          <h3 className="m-0 text-lg font-semibold text-gray-800 font-sans">
            即時舌診取景
          </h3>
          <button
            className="bg-transparent border-none text-[28px] text-gray-600 cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-gray-100 hover:text-gray-800"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 min-h-[400px] bg-gray-50">
          {error ? (
            <div className="text-center py-10 px-5">
              <p className="text-red-600 mb-5 text-sm">{error}</p>
              <button
                className="bg-mit-red text-white py-2.5 px-5 border-none rounded-md text-sm cursor-pointer transition-colors hover:bg-mit-red-dark"
                onClick={startCamera}
              >
                重試
              </button>
            </div>
          ) : capturedImage ? (
            <div className="w-full max-w-full border-2 border-gray-200 rounded-lg overflow-hidden bg-black">
              <img
                src={capturedImage}
                alt="拍攝的照片"
                className="w-full h-auto block"
              />
            </div>
          ) : (
            <div className="w-full max-w-full border-2 border-gray-200 rounded-lg overflow-hidden bg-black relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto block scale-x-[-1]"
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
              />
            </div>
          )}
        </div>

        {!error && !capturedImage && (
          <div className="px-6 pb-2 text-center text-xs text-gray-600">
            {statusText}
          </div>
        )}

        <div className="flex gap-3 py-5 px-6 border-t border-gray-200 justify-center">
          {capturedImage ? (
            <>
              <button
                className="py-3 px-6 border-none rounded-lg text-sm font-medium cursor-pointer transition-all font-sans bg-gray-100 text-gray-700 border border-gray-200 flex-1 hover:bg-gray-200"
                onClick={handleRetake}
              >
                重新拍攝
              </button>
              <button
                className="py-3 px-6 border-none rounded-lg text-sm font-medium cursor-pointer transition-all font-sans bg-mit-red text-white flex-1 hover:bg-mit-red-dark hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(214,69,69,0.3)] active:translate-y-0"
                onClick={handleUsePhoto}
              >
                使用此照片
              </button>
            </>
          ) : (
            <button
              className="py-3 px-6 border-none rounded-lg text-sm font-medium cursor-pointer transition-all font-sans bg-mit-red text-white w-full max-w-[200px] hover:bg-mit-red-dark hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(214,69,69,0.3)] active:translate-y-0"
              onClick={handleCapture}
            >
              手動拍攝
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraModal;

