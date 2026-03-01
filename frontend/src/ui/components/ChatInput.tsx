import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";

interface ChatInputProps {
  isLoading: boolean;
  selectedImage: string | null;
  onSubmit: (text: string) => void;
  onCameraClick: () => void;
  onFileChange: (dataUrl: string) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

const ChatInput = ({
  isLoading,
  selectedImage,
  onSubmit,
  onCameraClick,
  onFileChange,
  fileInputRef,
}: ChatInputProps) => {
  const [input, setInput] = useState("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("請只上傳圖片檔案");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      onFileChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;
    const text = input;
    setInput("");
    onSubmit(text);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 md:gap-3 max-w-[1200px] mx-auto"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        className="flex items-center justify-center w-11 h-11 border-none rounded-xl cursor-pointer transition-all shrink-0 bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        onClick={onCameraClick}
        disabled={isLoading}
        title="拍攝照片"
        aria-label="拍攝照片"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
      <input
        type="text"
        className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none transition-all shadow-sm placeholder:text-gray-400 focus:border-mit-red focus:shadow-[0_0_0_3px_rgba(214,69,69,0.1)] disabled:bg-gray-50 disabled:cursor-not-allowed"
        value={input}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setInput(e.target.value)
        }
        disabled={isLoading}
        placeholder={isLoading ? "正在處理..." : "輸入訊息..."}
      />
      <button
        type="submit"
        className="flex items-center justify-center w-11 h-11 border-none rounded-xl cursor-pointer transition-all shrink-0 bg-mit-red text-white shadow-[0_2px_4px_rgba(214,69,69,0.2)] hover:bg-mit-red-dark hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(214,69,69,0.3)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        disabled={isLoading || (!input.trim() && !selectedImage)}
        title="發送"
        aria-label="發送訊息"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
};

export default ChatInput;
