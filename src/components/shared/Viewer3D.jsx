import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';

/**
 * Modelos .obj enviados no admin podem vir em qualquer escala/unidade — sem
 * normalizar por bounding box, a câmera fixa não consegue enquadrar objetos
 * de tamanhos arbitrários.
 */
function fitModelToView(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2 / maxDimension;
  model.scale.setScalar(scale);

  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

function Model({ modelUrl, textureUrl }) {
  const obj = useLoader(OBJLoader, modelUrl);
  const texture = useTexture(textureUrl);
  const model = useMemo(() => obj.clone(), [obj]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({ map: texture });
      }
    });
    fitModelToView(model);
  }, [model, texture]);

  return <primitive object={model} />;
}

export default function Viewer3D({ modelUrl, textureUrl, className = '' }) {
  if (!modelUrl || !textureUrl) return null;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-bg ${className}`}>
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={1} />
        <directionalLight position={[-3, -2, -4]} intensity={0.3} />
        <Suspense fallback={null}>
          <Model modelUrl={modelUrl} textureUrl={textureUrl} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} />
      </Canvas>
    </div>
  );
}
