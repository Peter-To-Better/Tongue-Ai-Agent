interface ImagePreviewProps {
  imageUrl: string;
  onRemove: () => void;
}

const ImagePreview = ({ imageUrl, onRemove }: ImagePreviewProps) => {
  return (
    <div className="mb-3 flex max-w-[200px]">
      <div className="rounded-lg overflow-hidden border border-gray-200">
        <img
          src={imageUrl}
          alt="預覽"
          className="max-w-full max-h-[200px] block object-contain"
        />
      </div>
      <div className="flex-1">
        <button
          type="button"
          className="mx-auto block bg-mit-red text-white border-none rounded-full w-6 h-6 cursor-pointer text-lg leading-none flex items-center justify-center transition-all shadow-md hover:bg-[#c0392b] hover:scale-110"
          onClick={onRemove}
          aria-label="移除圖片"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default ImagePreview;
