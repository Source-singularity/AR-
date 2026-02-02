import { HandLandmarkerResult } from '../types';

// We declare the global variable injected by the CDN script
declare global {
  interface Window {
    vision: any;
  }
}

let handLandmarker: any = null;
let runningMode: 'IMAGE' | 'VIDEO' = 'VIDEO';

export const initializeHandLandmarker = async () => {
  try {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");
    const { HandLandmarker, FilesetResolver } = vision;

    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: runningMode,
      numHands: 1
    });
    console.log("HandLandmarker initialized");
    return true;
  } catch (error) {
    console.error("Error initializing HandLandmarker:", error);
    return false;
  }
};

export const detectHands = (video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
  if (!handLandmarker) return null;
  
  // Guard against invalid video dimensions which causes "RangeError: Invalid typed array length" in some MediaPipe builds
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }
  
  try {
    const result = handLandmarker.detectForVideo(video, timestamp);
    return result;
  } catch (e) {
    // Silently handle transient errors during frame drops or initialization
    // console.warn("Detection error:", e);
    return null;
  }
};