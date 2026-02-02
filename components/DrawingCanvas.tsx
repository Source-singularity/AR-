
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { Stroke, DrawMode } from '../types';

interface DrawingCanvasProps {
  handPosition: { x: number; y: number } | null;
  isPinching: boolean;
  mousePosition: { x: number; y: number } | null;
  isMouseDown: boolean;
  clearTrigger: number;
  activeColor: string;
  lineWidth: number;
  drawMode: DrawMode;
}

// 子组件：静态笔迹，使用 Line (Fat Lines) 提供高质量渲染
const StaticStroke: React.FC<{ points: THREE.Vector3[], color: string, width: number }> = React.memo(({ points, color, width }) => {
  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={width}
      transparent
      opacity={1}
    />
  );
});

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ 
  handPosition, 
  isPinching, 
  mousePosition, 
  isMouseDown, 
  clearTrigger,
  activeColor,
  lineWidth,
  drawMode
}) => {
  const { camera } = useThree();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPoints, setCurrentPoints] = useState<THREE.Vector3[]>([]);
  
  const currentStrokeRef = useRef<THREE.Vector3[]>([]);
  const lastPointRef = useRef<THREE.Vector3 | null>(null);
  const isFinalizingRef = useRef(false);

  // Define isInteracting here so it's accessible both in useFrame and in the JSX return
  const isInteracting = isPinching || (isMouseDown && !handPosition);

  useEffect(() => {
    if (clearTrigger > 0) {
      setStrokes([]);
      setCurrentPoints([]);
      currentStrokeRef.current = [];
      lastPointRef.current = null;
    }
  }, [clearTrigger]);

  const finalizeStroke = () => {
    if (isFinalizingRef.current || currentStrokeRef.current.length < 2) {
      currentStrokeRef.current = [];
      setCurrentPoints([]);
      return;
    }

    isFinalizingRef.current = true;
    const finalPoints = [...currentStrokeRef.current];
    
    setStrokes(prev => [
      ...prev, 
      { 
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
        points: finalPoints, 
        color: activeColor, 
        lineWidth: lineWidth 
      }
    ]);

    currentStrokeRef.current = [];
    setCurrentPoints([]);
    
    setTimeout(() => {
      isFinalizingRef.current = false;
    }, 50);
  };

  useFrame(() => {
    const activePos = handPosition || mousePosition;

    if (!activePos) {
      if (currentStrokeRef.current.length > 0) finalizeStroke();
      return;
    }

    const ndcX = (activePos.x * 2) - 1;
    const ndcY = -((activePos.y * 2) - 1);

    const drawingDepth = 0.5; 
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5); 
    vector.unproject(camera);
    
    if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || !Number.isFinite(vector.z)) {
      return;
    }

    const dir = vector.sub(camera.position).normalize();
    const pos = camera.position.clone().add(dir.multiplyScalar(drawingDepth));

    if (isInteracting) {
      if (drawMode === DrawMode.ERASING) {
        // Eraser logic: Remove any stroke that is near the current position
        // Proximity threshold based on brush size
        const eraseThreshold = 0.01 + (lineWidth * 0.002);
        
        setStrokes(prevStrokes => {
          let hasChange = false;
          const filtered = prevStrokes.filter(stroke => {
            const isNear = stroke.points.some(p => p.distanceTo(pos) < eraseThreshold);
            if (isNear) hasChange = true;
            return !isNear;
          });
          return hasChange ? filtered : prevStrokes;
        });
      } else {
        // Drawing logic
        if (!lastPointRef.current || pos.distanceTo(lastPointRef.current) > 0.005) {
          currentStrokeRef.current.push(pos.clone());
          lastPointRef.current = pos.clone();
          setCurrentPoints([...currentStrokeRef.current]);
        }
      }
    } else {
      if (currentStrokeRef.current.length > 0) {
        finalizeStroke();
      }
      lastPointRef.current = pos.clone();
    }
  });

  const activeLineGeometry = useMemo(() => {
    if (currentPoints.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(currentPoints);
  }, [currentPoints]);

  return (
    <>
      <ambientLight intensity={1} />
      
      {/* 渲染已完成的笔迹 */}
      {strokes.map((stroke) => (
        <StaticStroke 
          key={stroke.id} 
          points={stroke.points} 
          color={stroke.color} 
          width={stroke.lineWidth}
        />
      ))}

      {/* 渲染正在绘制的笔迹 */}
      {currentPoints.length > 1 && activeLineGeometry && drawMode === DrawMode.DRAWING && (
        <line geometry={activeLineGeometry}>
          <lineBasicMaterial color={activeColor} linewidth={2} />
        </line>
      )}
      
      {/* 笔触光标 */}
      {(handPosition || mousePosition) && (
         <mesh position={lastPointRef.current || new THREE.Vector3(0,0,0)} scale={((isInteracting) ? 0.012 : 0.006) * (lineWidth / 5)}>
            {drawMode === DrawMode.ERASING ? (
              <>
                <ringGeometry args={[0.8, 1, 32]} />
                <meshBasicMaterial color="#ff4444" transparent opacity={0.8} side={THREE.DoubleSide} />
              </>
            ) : (
              <>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color={activeColor} transparent opacity={0.6} />
              </>
            )}
         </mesh>
      )}
    </>
  );
};
