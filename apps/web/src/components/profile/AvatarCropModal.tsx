'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AvatarCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  onClose: () => void;
}

async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const size = 400;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        resolve(file);
      },
      'image/jpeg',
      0.92
    );
  });
}

export function AvatarCropModal({ imageSrc, onCropComplete, onClose }: AvatarCropModalProps) {
  const t = useT();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const file = await getCroppedImage(imageSrc, croppedAreaPixels);
      onCropComplete(file);
    } catch (err) {
    } finally {
      setIsProcessing(false);
    }
  };

  const zoomPercent = ((zoom - 1) / 2) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(4,8,18,0.88)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="w-full max-w-md mx-4 overflow-hidden"
        style={{
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: '12px',
          boxShadow: `0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(56,182,255,0.06)`,
        }}
      >

        {/* ── Header ──────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Icon badge */}
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: 'rgba(56,182,255,0.1)',
              border: `1px solid ${C.border2}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {/* Crop crosshair symbol */}
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.5" stroke={C.accent} strokeWidth="1.4" />
                <line x1="7" y1="1" x2="7" y2="4" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" />
                <line x1="7" y1="10" x2="7" y2="13" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" />
                <line x1="1" y1="7" x2="4" y2="7" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" />
                <line x1="10" y1="7" x2="13" y2="7" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: C.text, margin: 0 }}>
              {t.avatar_crop_title}
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: 'transparent',
              border: 'none',
              color: C.text3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.hover;
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = C.text3;
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* ── Cropper canvas ───────────────────────────────────── */}
        <div style={{ position: 'relative', height: '300px', background: C.bg }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* ── Controls ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '12px 16px 14px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Zoom row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Zoom out */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              style={iconBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'transparent'; }}
            >
              <ZoomOut size={12} />
            </button>

            {/* Custom track */}
            <div style={{ flex: 1, position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
              {/* Track background */}
              <div style={{
                position: 'absolute',
                left: 0, right: 0,
                height: '2px',
                background: C.border2,
                borderRadius: '2px',
                pointerEvents: 'none',
              }} />
              {/* Track fill */}
              <div style={{
                position: 'absolute',
                left: 0,
                width: `${zoomPercent}%`,
                height: '2px',
                background: `linear-gradient(90deg, ${C.accent}, ${C.purple})`,
                borderRadius: '2px',
                pointerEvents: 'none',
                transition: 'width 0.04s',
              }} />
              {/* Thumb dot */}
              <div style={{
                position: 'absolute',
                left: `calc(${zoomPercent}% - 5px)`,
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: C.accent,
                boxShadow: `0 0 8px rgba(56,182,255,0.5)`,
                pointerEvents: 'none',
                transition: 'left 0.04s',
              }} />
              {/* Invisible range input on top */}
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  width: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  height: '20px',
                  margin: 0, padding: 0,
                }}
              />
            </div>

            {/* Zoom in */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              style={iconBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'transparent'; }}
            >
              <ZoomIn size={12} />
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }}
              title={t.avatar_crop_btn_reset}
              style={iconBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'transparent'; }}
            >
              <RotateCcw size={11} />
            </button>

            {/* Zoom label */}
            <span style={{
              fontSize: '11px',
              color: C.text3,
              minWidth: '30px',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}>
              {zoom.toFixed(1)}×
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                fontWeight: 500,
                background: 'transparent',
                color: C.text2,
                border: `1px solid ${C.border}`,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.15s',
                opacity: isProcessing ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.borderColor = C.border2; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
            >
              {t.btn_cancel}
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                fontWeight: 600,
                background: isProcessing ? C.border : C.accent,
                color: isProcessing ? C.text3 : '#080c14',
                border: 'none',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
                opacity: isProcessing ? 0.7 : 1,
              }}
            >
              {isProcessing && <Loader2 size={11} className="animate-spin" />}
              {isProcessing ? t.avatar_crop_btn_processing : t.avatar_crop_btn_apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared icon button style ──────────────────────────────────────────────────
const iconBtnStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  borderRadius: '5px',
  background: 'transparent',
  border: 'none',
  color: C.text3,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.15s',
};
