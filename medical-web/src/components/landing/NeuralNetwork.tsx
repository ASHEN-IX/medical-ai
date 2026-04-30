"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function NeuralNetwork({
  position = [-6, 0, -8] as [number, number, number],
}) {
  const groupRef = useRef<THREE.Group>(null!);

  const { nodes, connections } = useMemo(() => {
    const n: [number, number, number][] = [];
    const c: { from: number; to: number }[] = [];

    const layers = [4, 6, 8, 6, 4];
    let idx = 0;
    const layerIndices: number[][] = [];

    layers.forEach((count, layerIdx) => {
      const layerNodes: number[] = [];
      for (let i = 0; i < count; i++) {
        const x = (layerIdx - 2) * 2;
        const y = (i - count / 2) * 1.2;
        const z = Math.sin(layerIdx * 0.5) * 0.5;
        n.push([x, y, z]);
        layerNodes.push(idx);
        idx++;
      }
      layerIndices.push(layerNodes);
    });

    for (let l = 0; l < layerIndices.length - 1; l++) {
      for (const from of layerIndices[l]) {
        const targets = layerIndices[l + 1]
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        for (const to of targets) {
          c.push({ from, to });
        }
      }
    }

    return { nodes: n, connections: c };
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y =
      Math.sin(state.clock.elapsedTime * 0.2) * 0.3;
  });

  return (
    <group ref={groupRef} position={position} scale={0.7}>
      {nodes.map((pos, i) => (
        <mesh key={`node-${i}`} position={pos}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={1.2}
          />
        </mesh>
      ))}
      {connections.map(({ from, to }, i) => {
        const start = new THREE.Vector3(...nodes[from]);
        const end = new THREE.Vector3(...nodes[to]);
        const mid = start.clone().lerp(end, 0.5);
        const length = start.distanceTo(end);
        const direction = end.clone().sub(start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        );

        return (
          <mesh
            key={`conn-${i}`}
            position={[mid.x, mid.y, mid.z]}
            quaternion={quaternion}
          >
            <cylinderGeometry args={[0.008, 0.008, length, 4]} />
            <meshStandardMaterial
              color="#06b6d4"
              emissive="#06b6d4"
              emissiveIntensity={0.6}
              transparent
              opacity={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}
