import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export function InnerCore() {
  const core = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.Mesh>(null);
  const auraMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const slowPulse = 0.5 + 0.5 * Math.sin(t * 0.17 + Math.sin(t * 0.047) * 1.4);
    const shimmer = 0.5 + 0.5 * Math.sin(t * 0.37 + Math.sin(t * 0.091) * 1.7);
    const scale = 1 + slowPulse * 0.018;
    if (core.current) core.current.scale.setScalar(scale);
    if (aura.current) aura.current.scale.setScalar(1.0 + slowPulse * 0.13);
    if (auraMaterial.current)
      auraMaterial.current.opacity = 0.14 + slowPulse * 0.12 + shimmer * 0.035;
    if (light.current) light.current.intensity = 1.4 + slowPulse * 1.1 + shimmer * 0.22;
  });

  return (
    <group>
      <mesh ref={aura}>
        <sphereGeometry args={[0.31, 32, 32]} />
        <meshBasicMaterial
          ref={auraMaterial}
          color="#48bfff"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.105, 3]} />
        <meshBasicMaterial color="#e9fdff" toneMapped={false} />
      </mesh>
      <mesh scale={1.8}>
        <sphereGeometry args={[0.105, 20, 20]} />
        <meshBasicMaterial
          color="#7de5ff"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} color="#66dfff" intensity={2.2} distance={2.7} decay={2} />
    </group>
  );
}
