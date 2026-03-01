export interface SSECallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onStatus?: (status: string) => void;
}

export const parseSSEStream = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: SSECallbacks
): (() => void) => {
  const { onChunk, onComplete, onError, onStatus } = callbacks;
  const decoder = new TextDecoder();
  let buffer = "";

  const readStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onComplete();
              return;
            }

            try {
              const json = JSON.parse(data);

              if (json.type === "status" && json.message && onStatus) {
                onStatus(json.message);
              }
              if (json.type === "content" && json.content) {
                onChunk(json.content);
              }
              if (json.error) {
                onError(json.error);
                return;
              }
              const content = json.content || json.chunk || json.response || "";
              if (content && !json.type) {
                onChunk(content);
              }
            } catch {
              if (data.trim()) {
                onChunk(data);
              }
            }
          } else if (line.trim()) {
            try {
              const json = JSON.parse(line);
              const content = json.content || json.chunk || json.response || "";
              if (content) {
                onChunk(content);
              }
            } catch {
              if (line.trim()) {
                onChunk(line);
              }
            }
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "讀取流時發生錯誤";
      onError(errorMessage);
    }
  };

  readStream();

  return () => {
    reader.cancel();
  };
};

export const convertBase64ToBlob = (base64Data: string): Blob => {
  let mimeType = "image/jpeg";
  let base64String = base64Data;

  if (base64Data.startsWith("data:")) {
    const matches = base64Data.match(/data:([^;]+);base64,(.+)/);
    if (matches) {
      mimeType = matches[1];
      base64String = matches[2];
    }
  }

  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

export const parseJsonErrorResponse = async (
  response: Response,
  defaultMessage: string
): Promise<string> => {
  const errorData = await response.json().catch(() => ({}));
  return (errorData as { detail?: string }).detail || defaultMessage;
};

export const parseTextErrorResponse = async (
  response: Response,
  defaultMessage: string
): Promise<string> => {
  let errorMessage = defaultMessage;
  try {
    const errorText = await response.text();
    if (errorText) {
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
    }
  } catch {
    // ignore
  }
  if (response.status === 404) {
    errorMessage = `API 端點未找到。請確保 FastAPI 服務正在運行，並且端點路徑正確。`;
  }
  return errorMessage;
};

export const handleConnectionError = (
  error: unknown,
  baseUrl: string,
  onError: (error: string) => void
): void => {
  if (error instanceof Error) {
    if (
      error.message?.includes("fetch failed") ||
      error.message?.includes("ECONNREFUSED")
    ) {
      onError(`無法連接到 FastAPI 服務 (${baseUrl})，請確保服務正在運行`);
    } else {
      onError(error.message || "發生未知錯誤");
    }
  } else {
    onError("發生未知錯誤");
  }
};
