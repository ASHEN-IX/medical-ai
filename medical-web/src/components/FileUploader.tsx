"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

interface FileUploaderProps {
  file: File | null;
  disabled?: boolean;
  onFileSelected: (file: File | null, imageBase64: string | null) => void;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);

function toFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function isSupportedFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (ACCEPTED_EXTENSIONS.has(extension)) {
    return true;
  }

  return ACCEPTED_MIME.has(file.type);
}

export default function FileUploader({ file, disabled = false, onFileSelected }: FileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const clearSelection = () => {
    setError(null);
    onFileSelected(null, null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleFile = async (nextFile: File | null) => {
    if (!nextFile) {
      clearSelection();
      return;
    }

    if (!isSupportedFile(nextFile)) {
      setError("Unsupported file format. Please upload PDF, PNG, JPG, or JPEG.");
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setError(null);

    const isImage = nextFile.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(nextFile.name);
    if (!isImage) {
      onFileSelected(nextFile, null);
      return;
    }

    try {
      const imageBase64 = await toFileDataUrl(nextFile);
      onFileSelected(nextFile, imageBase64);
    } catch {
      setError("Image could not be read. Please choose a different image.");
    }
  };

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    await handleFile(selectedFile);
  };

  const onDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);

    if (disabled) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0] || null;
    await handleFile(droppedFile);
  };

  return (
    <div className="space-y-3">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
          dragging
            ? "border-cyan-500 bg-cyan-50"
            : "border-slate-300 bg-white/75 hover:border-cyan-400 hover:bg-cyan-50/60"
        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="hidden"
          disabled={disabled}
          onChange={onInputChange}
        />

        <p className="text-lg font-semibold text-slate-800">Drop report file here</p>
        <p className="mt-2 text-sm text-slate-500">or click to upload PDF or medical image</p>
        <p className="mt-1 text-xs text-slate-400">Max {MAX_FILE_SIZE_MB} MB</p>
      </label>

      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Remove
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
