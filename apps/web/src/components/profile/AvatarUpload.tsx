// apps/web/src/components/profile/AvatarUpload.tsx

'use client';

import { useState, useRef } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { AvatarCropModal } from './AvatarCropModal';

interface AvatarUploadProps {
  currentAvatar?: string;
  userName: string;
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export function AvatarUpload({ currentAvatar, userName, onUpload, isLoading }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (10MB antes del crop)
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen debe ser menor a 10MB');
      return;
    }

    // Leer el archivo y abrir el modal de crop
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // Reset input para poder seleccionar el mismo archivo de nuevo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (file: File) => {
    setCroppedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setShowCropModal(false);
    // rawImageSrc se conserva para poder volver a recortar
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    // Si aún no hay preview (primera vez), cancelar limpia todo
    if (!preview) {
      setRawImageSrc(null);
    }
  };

  const handleUpload = async () => {
    if (!croppedFile) return;
    await onUpload(croppedFile);
    setPreview(null);
    setCroppedFile(null);
    setRawImageSrc(null);
  };

  const handleCancel = () => {
    setPreview(null);
    setCroppedFile(null);
    setRawImageSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarUrl = preview || getAvatarUrl(currentAvatar);

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-32 w-32 border-4 border-zinc-800">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={userName} />
          ) : (
            <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {getInitials(userName)}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="flex flex-col items-center gap-2">
          {!preview ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Cambiar Avatar
              </Button>
              <p className="text-xs text-zinc-500">JPG, PNG o GIF (máximo 10MB)</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-text-muted">Vista previa del recorte</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleUpload} disabled={isLoading}>
                  {isLoading ? 'Subiendo...' : 'Guardar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCropModal(true)}
                  disabled={isLoading || !rawImageSrc}
                >
                  Recortar de nuevo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCropModal && rawImageSrc && (
        <AvatarCropModal
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
          onClose={handleCropCancel}
        />
      )}
    </>
  );
}
