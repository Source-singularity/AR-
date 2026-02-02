import React, { useEffect, useRef } from 'react';

interface VideoBackgroundProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  isMirrored?: boolean;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ onVideoReady, isMirrored = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const startCamera = async () => {
      if (!videoRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Default to environment, but mirroring UI handles selfie feel
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
             videoRef.current.play();
             onVideoReady(videoRef.current);
          }
        };
      } catch (err) {
        console.error("Camera access denied or not available:", err);
      }
    };

    startCamera();

    return () => {
      // Cleanup stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onVideoReady]);

  return (
    <video
      ref={videoRef}
      className="fixed top-0 left-0 w-full h-full object-cover z-0 pointer-events-none transition-transform duration-500"
      style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
      playsInline
      muted
      autoPlay
    />
  );
};