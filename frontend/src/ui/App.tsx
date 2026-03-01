import "./reset.css";
import { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/chat-message/chat-message";
import CameraModal from "./components/camera-modal/camera-modal";
import WeeklyReportModal from "./components/weekly-report-modal";
import ChatInput from "./components/ChatInput";
import ImagePreview from "./components/ImagePreview";
import { useChatSession } from "../hooks/useChatSession";
import mitLogo from "/logo.png";
import { BarChart3 } from "lucide-react";

const App = () => {
  const { userId, chatLog, isLoading, handleSubmit } = useChatSession();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const handleFormSubmit = async (text: string) => {
    const imageUrl = selectedImage;
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await handleSubmit(text, imageUrl);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-gray-800 overflow-hidden font-sans">
      <header className="h-[70px] bg-white border-b border-gray-200 flex items-center px-6 md:px-6 shrink-0 shadow-sm justify-between">
        <div className="flex items-center">
          <div className="flex items-baseline gap-1 font-semibold tracking-tight">
            <img src={mitLogo} alt="MIT Logo" width={200} className="h-[70px]" />
          </div>
        </div>
        <button
          onClick={() => setIsWeeklyReportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-mit-red transition-all shadow-sm group"
          title="查看健康週報"
        >
          <BarChart3 size={18} className="group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">健康週報</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb:hover]:bg-gray-400">
          {chatLog.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center py-10">
              <div className="text-6xl mb-4 opacity-50">💬</div>
              <h2 className="text-xl font-semibold text-gray-600 mb-2">開始對話</h2>
              <p className="text-sm text-gray-400">輸入訊息或拍攝照片來開始分析</p>
            </div>
          )}
          {chatLog.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="bg-white border-t border-gray-200 py-3 px-4 md:py-4 md:px-6 shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
          {selectedImage && (
            <ImagePreview imageUrl={selectedImage} onRemove={handleRemoveImage} />
          )}
          <ChatInput
            isLoading={isLoading}
            selectedImage={selectedImage}
            onSubmit={handleFormSubmit}
            onCameraClick={() => setIsCameraOpen(true)}
            onFileChange={(dataUrl) => setSelectedImage(dataUrl)}
            fileInputRef={fileInputRef}
          />
        </div>
      </main>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(imageDataUrl) => setSelectedImage(imageDataUrl)}
      />

      <WeeklyReportModal
        isOpen={isWeeklyReportOpen}
        onClose={() => setIsWeeklyReportOpen(false)}
        userId={userId}
      />
    </div>
  );
};

export default App;
