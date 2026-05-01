"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function DataStream({
  position = [0, 0, 0] as [number, number, number],
  count = 50,
}) {
  const groupRef = useRef<THREE.Group>(null!);

  const streams = useMemo(() => {
    const items: { x: number; z: number; speed: number; offset: number }[] = [];
    for (let i = 0; i < count; i++) {
      items.push({
        x: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 20 - 10,
        speed: Math.random() * 2 + 1,
        offset: Math.random() * 10,
      });
    }
    return items;
  }, [count]);

  return (
    <group ref={groupRef} position={position}>
      {streams.map((stream, i) => (
        <StreamLine key={i} {...stream} />
      ))}
    </group>
  );
}

function StreamLine({
  x,
  z,
  speed,
  offset,
}: {
  x: number;
  z: number;
  speed: number;
  offset: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    meshRef.current.position.y = ((t % 20) - 10);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.sin((t % 20) * 0.3) * 0.5 + 0.3;
  });

  return (
    <mesh ref={meshRef} position={[x, 0, z]}>
      <boxGeometry args={[0.02, 0.5, 0.02]} />
      <meshStandardMaterial
        color={Math.random() > 0.5 ? "#7c3aed" : "#06b6d4"}
        emissive={Math.random() > 0.5 ? "#7c3aed" : "#06b6d4"}
        emissiveIntensity={1.5}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
