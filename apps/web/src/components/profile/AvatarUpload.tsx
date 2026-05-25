// apps/web/src/components/profile/AvatarUpload.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Crop } from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { AvatarCropModal } from './AvatarCropModal';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

interface AvatarUploadProps {
  currentAvatar?: string;
  userName: string;
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export function AvatarUpload({ currentAvatar, userName, onUpload, isLoading }: AvatarUploadProps) {
  const t = useT();
  const [preview, setPreview] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t.avatar_alert_invalid);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(t.avatar_alert_too_large);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (file: File) => {
    setCroppedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setShowCropModal(false);
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
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

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const avatarUrl = preview || getAvatarUrl(currentAvatar);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const ringActive = isHovered && !preview && !isLoading;

  return (
    <>
      <div className="flex flex-col items-center gap-4" style={{ width: '100%' }}>

        {/* ── Avatar ring + image ───────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />

          {/* Outer ring — gradient on hover, subtle border at rest */}
          <button
            type="button"
            disabled={isLoading || !!preview}
            onClick={() => !preview && fileInputRef.current?.click()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              position: 'relative',
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              padding: '2px',
              background: ringActive
                ? `linear-gradient(135deg, ${C.accent}, ${C.purple})`
                : `linear-gradient(135deg, ${C.border2}, rgba(56,182,255,0.05))`,
              cursor: isLoading || preview ? 'default' : 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: ringActive ? `0 0 22px rgba(56,182,255,0.22)` : 'none',
              outline: 'none',
              border: 'none',
            }}
          >
            {/* Inner circle */}
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              background: C.surface2,
              position: 'relative',
            }}>

              {/* Avatar image */}
              {avatarUrl && !imgError ? (
                <img
                  src={avatarUrl}
                  alt={userName}
                  crossOrigin="anonymous"
                  onError={() => setImgError(true)}
                  onLoad={() => setImgError(false)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                /* Initials fallback */
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #122a5e 0%, #1e1060 100%)',
                  fontSize: '26px',
                  fontWeight: 700,
                  color: C.text,
                  letterSpacing: '-0.5px',
                }}>
                  {getInitials(userName)}
                </div>
              )}

              {/* Hover overlay — camera icon */}
              {!preview && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(8,12,20,0.72)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  opacity: isHovered && !isLoading ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                  borderRadius: '50%',
                }}>
                  {isLoading ? (
                    <Loader2 size={18} style={{ color: C.accent }} className="animate-spin" />
                  ) : (
                    <>
                      <Camera size={17} style={{ color: C.accent }} />
                      <span style={{
                        fontSize: '9px',
                        color: C.accent,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        Cambiar
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </button>

          {/* Preview-ready dot */}
          {preview && (
            <span style={{
              position: 'absolute',
              bottom: '3px',
              right: '3px',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              background: C.green,
              border: `2px solid ${C.surface}`,
              display: 'block',
            }} />
          )}
        </div>

        {/* ── Info / action area ───────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2.5" style={{ width: '100%' }}>
          {!preview ? (
            <p style={{
              fontSize: '11px',
              color: C.text4,
              textAlign: 'center',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {t.avatar_format_hint}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2.5" style={{ width: '100%' }}>

              {/* Preview badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '4px',
                background: 'rgba(56,182,255,0.07)',
                border: `1px solid ${C.border}`,
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: C.green,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '11px', color: C.text2 }}>
                  {t.avatar_crop_preview}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

                {/* Save */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleUpload}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    background: isLoading ? C.border : C.accent,
                    color: isLoading ? C.text3 : '#080c14',
                    border: 'none',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.15s',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading && <Loader2 size={11} className="animate-spin" />}
                  {isLoading ? t.avatar_btn_uploading : t.avatar_btn_save}
                </button>

                {/* Recrop */}
                <button
                  type="button"
                  disabled={isLoading || !rawImageSrc}
                  onClick={() => setShowCropModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    background: 'transparent',
                    color: C.text2,
                    border: `1px solid ${C.border2}`,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.15s',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.borderColor = C.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; }}
                >
                  <Crop size={11} />
                  {t.avatar_btn_recrop}
                </button>

                {/* Cancel (icon only) */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleCancel}
                  title="Cancelar"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: C.text3,
                    border: `1px solid ${C.border}`,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = `rgba(239,68,68,0.35)`; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border; }}
                >
                  <X size={12} />
                </button>
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
