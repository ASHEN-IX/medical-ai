"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Preload, Environment } from "@react-three/drei";
import * as THREE from "three";
import ParticleField from "./ParticleField";
import FloatingElements from "./FloatingElements";
import DNAHelix from "./DNAHelix";
import HolographicRing from "./HolographicRing";
import NeuralNetwork from "./NeuralNetwork";
import DataStream from "./DataStream";

function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current.x * 1.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouse.current.y * 1 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, -5);
  });

  return null;
}

function SceneLighting() {
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
    if (!lightRef.current) return;
    const t = state.clock.elapsedTime;
    lightRef.current.position.x = Math.sin(t * 0.3) * 8;
    lightRef.current.position.y = Math.cos(t * 0.2) * 5;
    lightRef.current.intensity = 0.8 + Math.sin(t) * 0.2;
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight
        ref={lightRef}
        position={[5, 5, 5]}
        intensity={0.8}
        color="#7c3aed"
        distance={30}
      />
      <pointLight position={[-8, -3, 3]} intensity={0.4} color="#06b6d4" distance={25} />
      <pointLight position={[0, 8, -5]} intensity={0.3} color="#a855f7" distance={20} />
      <spotLight
        position={[0, 10, 10]}
        angle={0.5}
        penumbra={1}
        intensity={0.5}
        color="#818cf8"
        castShadow={false}
      />
    </>
  );
}

export default function Scene3D() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 55, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SceneLighting />
          <CameraRig />

          <ParticleField count={2500} />
          <FloatingElements />
          <DNAHelix />
          <HolographicRing radius={3.5} position={[0, 0, -6]} speed={0.5} />
          <HolographicRing radius={2} position={[-5, -3, -10]} speed={0.8} color="#06b6d4" />
          <NeuralNetwork position={[-7, 1, -8]} />
          <DataStream position={[0, 0, -8]} count={40} />

          <fog attach="fog" args={["#020617", 15, 45]} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
