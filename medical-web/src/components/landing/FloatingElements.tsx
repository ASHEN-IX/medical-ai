"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

function EnergyOrb({
  position,
  color,
  size,
  speed,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  speed: number;
}) {
  const mesh = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime * speed;
    mesh.current.position.y = position[1] + Math.sin(t) * 0.5;
    mesh.current.position.x = position[0] + Math.cos(t * 0.7) * 0.3;
    mesh.current.scale.setScalar(1 + Math.sin(t * 2) * 0.1);

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.5 + Math.sin(t * 3) * 0.2);
    }
  });

  return (
    <group>
      <mesh ref={glowRef} position={position}>
        <sphereGeometry args={[size * 1.5, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.05} />
      </mesh>
      <Float speed={speed} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh ref={mesh} position={position}>
          <sphereGeometry args={[size, 32, 32]} />
          <MeshDistortMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.4}
            distort={0.5}
            speed={3}
            roughness={0.1}
            metalness={0.8}
          />
        </mesh>
      </Float>
    </group>
  );
}

function HexGrid({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = state.clock.elapsedTime * 0.05;
  });

  const hexagons = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 2;
    hexagons.push([Math.cos(angle) * r, Math.sin(angle) * r, 0] as [number, number, number]);
  }

  return (
    <group ref={groupRef} position={position}>
      {hexagons.map((pos, i) => (
        <mesh key={i} position={pos}>
          <circleGeometry args={[0.3, 6]} />
          <meshStandardMaterial
            color="#7c3aed"
            emissive="#7c3aed"
            emissiveIntensity={0.3}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function FloatingElements() {
  return (
    <group>
      <EnergyOrb position={[-5, 3, -6]} color="#7c3aed" size={0.6} speed={1.2} />
      <EnergyOrb position={[4, -2, -8]} color="#06b6d4" size={0.4} speed={1.5} />
      <EnergyOrb position={[7, 2, -5]} color="#8b5cf6" size={0.5} speed={0.9} />
      <EnergyOrb position={[-3, -4, -10]} color="#3b82f6" size={0.7} speed={1.1} />
      <EnergyOrb position={[0, 5, -12]} color="#a855f7" size={0.3} speed={1.8} />

      <HexGrid position={[-7, -2, -12]} />
      <HexGrid position={[8, 3, -15]} />
    </group>
  );
}
