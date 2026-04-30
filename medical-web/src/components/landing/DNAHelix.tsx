"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function DNAHelix() {
  const groupRef = useRef<THREE.Group>(null!);
  const strandCount = 60;

  const spheres = useMemo(() => {
    const items: {
      pos1: [number, number, number];
      pos2: [number, number, number];
      index: number;
    }[] = [];
    for (let i = 0; i < strandCount; i++) {
      const t = (i / strandCount) * Math.PI * 4;
      const y = (i / strandCount) * 12 - 6;
      items.push({
        pos1: [Math.cos(t) * 1.5, y, Math.sin(t) * 1.5],
        pos2: [Math.cos(t + Math.PI) * 1.5, y, Math.sin(t + Math.PI) * 1.5],
        index: i,
      });
    }
    return items;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
  });

  return (
    <group ref={groupRef} position={[6, 0, -5]}>
      {spheres.map(({ pos1, pos2, index }) => (
        <group key={index}>
          <mesh position={pos1}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial
              color="#7c3aed"
              emissive="#7c3aed"
              emissiveIntensity={0.8}
            />
          </mesh>
          <mesh position={pos2}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial
              color="#06b6d4"
              emissive="#06b6d4"
              emissiveIntensity={0.8}
            />
          </mesh>
          {index % 4 === 0 && (
            <mesh
              position={[
                (pos1[0] + pos2[0]) / 2,
                (pos1[1] + pos2[1]) / 2,
                (pos1[2] + pos2[2]) / 2,
              ]}
              rotation={[
                0,
                0,
                Math.atan2(pos2[1] - pos1[1], pos2[0] - pos1[0]),
              ]}
            >
              <cylinderGeometry args={[0.015, 0.015, 3, 6]} />
              <meshStandardMaterial
                color="#a78bfa"
                emissive="#a78bfa"
                emissiveIntensity={0.4}
                transparent
                opacity={0.5}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
