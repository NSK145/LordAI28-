import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type OrbitalRingProps = {
  radius: number;
  rotation: [number, number, number];
  speed: number;
  phase: number;
};

const vertexShader = /* glsl */ `
  varying float vAngle;
  uniform float uTime;
  uniform float uPhase;
  void main() {
    vAngle = uv.x * 6.28318530718;
    vec3 p = position;
    float breath = sin(vAngle * 23.0 + uTime * 0.42 + uPhase) * 0.0011;
    breath += sin(vAngle * 7.0 - uTime * 0.19 + uPhase * 2.1) * 0.0015;
    p += normal * breath;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAngle;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPhase;
  uniform float uHalo;
  void main() {
    float phase = vAngle / 6.28318530718;
    float pulseA = fract(phase - uTime * uSpeed - uPhase);
    float pulseB = fract(phase + uTime * uSpeed * 0.63 + uPhase * 1.73);
    float arcA = pow(max(0.0, 1.0 - abs(pulseA - 0.5) * 2.0), 22.0);
    float arcB = pow(max(0.0, 1.0 - abs(pulseB - 0.5) * 2.0), 18.0) * 0.62;
    float glint = max(arcA, arcB);
    float softPulse = 0.5 + 0.5 * sin(vAngle * 2.0 - uTime * 0.31 + uPhase);
    float alpha = mix(0.13 + softPulse * 0.07 + glint * 0.8, 0.055 + glint * 0.34, uHalo);
    vec3 color = mix(vec3(0.10, 0.40, 0.92), vec3(0.62, 0.91, 1.0), clamp(glint * 1.4 + softPulse * 0.24, 0.0, 1.0));
    float gain = mix(0.8 + glint * 3.4, 0.65 + glint * 1.5, uHalo);
    gl_FragColor = vec4(color * gain, alpha);
  }
`;

export function OrbitalRing({ radius, rotation, speed, phase }: OrbitalRingProps) {
  const group = useRef<THREE.Group>(null);
  const spark = useRef<THREE.Mesh>(null);
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: speed },
          uPhase: { value: phase },
          uHalo: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [speed, phase],
  );
  const haloMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: speed },
          uPhase: { value: phase },
          uHalo: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [speed, phase],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (group.current) {
      group.current.rotation.set(
        rotation[0] + Math.sin(t * 0.11 + phase) * 0.025,
        rotation[1] + t * speed + Math.sin(t * 0.071 + phase * 1.7) * 0.035,
        rotation[2] + Math.cos(t * 0.093 + phase) * 0.022,
      );
    }
    coreMaterial.uniforms.uTime.value = t;
    haloMaterial.uniforms.uTime.value = t;
    if (spark.current) {
      const angle = t * speed * 1.8 + phase;
      spark.current.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      const flicker = 0.78 + 0.22 * Math.sin(t * 1.3 + phase * 3.0);
      spark.current.scale.setScalar(flicker);
    }
    // Keeping the ring motion independent while smoothing any frame-time jitter.
    if (group.current) group.current.rotation.y += delta * 0.002 * Math.sin(t * 0.17 + phase);
  });

  return (
    <group ref={group}>
      <mesh>
        <torusGeometry args={[radius, 0.006, 5, 256]} />
        <primitive object={coreMaterial} attach="material" />
      </mesh>
      <mesh>
        <torusGeometry args={[radius, 0.022, 5, 256]} />
        <primitive object={haloMaterial} attach="material" />
      </mesh>
      <mesh ref={spark}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshBasicMaterial color="#e5fcff" toneMapped={false} />
        <mesh scale={2.1}>
          <sphereGeometry args={[0.022, 10, 10]} />
          <meshBasicMaterial
            color="#61cfff"
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </mesh>
    </group>
  );
}
