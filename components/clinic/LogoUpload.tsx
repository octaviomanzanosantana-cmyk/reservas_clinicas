"use client";

import { useCallback, useRef, useState } from "react";

type LogoUploadProps = {
  currentUrl: string;
  onUploaded: (url: string) => void;
};

const ALLOWED_EXTENSIONS = ".jpg,.jpeg,.png,.svg,.webp";
const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function LogoUpload({ currentUrl, onUploaded }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const displayUrl = preview ?? currentUrl;

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (file.size > MAX_SIZE_BYTES) {
      setError(`El archivo supera el límite de ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/clinics/upload-logo", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Error al subir el logo");
      }

      setPreview(data.url);
      onUploaded(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  return (
    <div>
      <span className="text-sm font-medium text-foreground">Logo de la clínica</span>

      {displayUrl ? (
        <div className="mt-2 rounded-[10px] border border-border bg-background p-4">
          <div className="flex items-center gap-4">
            <img
              src={displayUrl}
              alt="Logo"
              className="h-16 w-16 rounded-[8px] object-contain"
            />
            <div className="flex-1 min-w-0">
              {uploading ? (
                <p className="text-sm text-muted">Subiendo...</p>
              ) : (
                <p className="text-sm text-muted">Logo actual</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onUploaded("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-[8px] border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Cambiar
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-2 flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary-soft"
              : "border-border bg-background"
          }`}
        >
          <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="mt-2 text-sm text-muted">
            Arrastra tu logo aquí o{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-primary underline"
            >
              selecciona un archivo
            </button>
          </p>
          <p className="mt-1 text-xs text-muted">
            JPG, PNG, SVG o WebP · Máximo {MAX_SIZE_MB}MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleInputChange}
        className="hidden"
      />

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
