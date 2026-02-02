import * as THREE from 'three';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Stroke {
  id: string;
  points: THREE.Vector3[];
  color: string;
  lineWidth: number;
}

export interface HandLandmarkerResult {
  landmarks: Array<Array<{ x: number; y: number; z: number }>>;
}

export enum DrawMode {
  IDLE = 'IDLE',
  DRAWING = 'DRAWING',
  ERASING = 'ERASING'
}
