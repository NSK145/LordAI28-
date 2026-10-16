import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uTime;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 2.6);
    float breathing = 0.5 + 0.5 * sin(uTime * 0.19 + sin(uTime * 0.052) * 1.2);
    float intensity = 0.12 + fresnel * (0.48 + breathing * 0.22);
    vec3 color = mix(vec3(0.025, 0.18, 0.64), vec3(0.27, 0.75, 1.0), fresnel);
    gl_FragColor = vec4(color * (0.32 + fresnel * 1.7 + breathing * 0.18), intensity * 0.34);
  }
`;

export function GlowEffect() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh scale={1.055}>
      <sphereGeometry args={[1.02, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
