import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  attribute vec4 aOrbit;
  uniform float uTime;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSize;
  void main() {
    float radius = aOrbit.x + sin(uTime * 0.16 + aOrbit.y * 2.7) * 0.022;
    float angle = aOrbit.y + uTime * aOrbit.z + sin(uTime * 0.13 + aOrbit.y) * 0.045;
    float phase = aOrbit.y;
    vec3 p = vec3(
      cos(angle) * radius,
      sin(angle * 0.83 + phase) * radius * 0.56,
      sin(angle * 0.71 + phase * 1.4) * radius * 0.42
    );
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = max(1.0, aOrbit.w * (220.0 / -mvPosition.z));
    vSize = aOrbit.w;
    vAlpha = uOpacity * (0.42 + 0.58 * (0.5 + 0.5 * sin(uTime * (0.21 + abs(aOrbit.z)) + phase * 3.0)));
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vSize;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float glow = exp(-d * d * 8.0);
    float core = smoothstep(0.3, 0.0, d);
    vec3 color = mix(vec3(0.25, 0.72, 1.0), vec3(0.82, 0.97, 1.0), core);
    gl_FragColor = vec4(color * (0.45 + glow * 1.6), vAlpha * glow);
  }
`;

function makeOrbitData(count: number, minRadius: number, maxRadius: number) {
  const positions = new Float32Array(count * 3);
  const orbits = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    orbits[i * 4] = minRadius + Math.random() * (maxRadius - minRadius);
    orbits[i * 4 + 1] = Math.random() * Math.PI * 2;
    orbits[i * 4 + 2] = (Math.random() * 0.24 + 0.025) * (Math.random() > 0.5 ? 1 : -1);
    orbits[i * 4 + 3] = 0.7 + Math.random() * 1.6;
  }
  return { positions, orbits };
}

function SwirlingPoints({
  count,
  minRadius,
  maxRadius,
  opacity,
}: {
  count: number;
  minRadius: number;
  maxRadius: number;
  opacity: number;
}) {
  const data = useMemo(
    () => makeOrbitData(count, minRadius, maxRadius),
    [count, minRadius, maxRadius],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: opacity } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [opacity],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aOrbit" args={[data.orbits, 4]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}

export function ParticleField() {
  return (
    <>
      <SwirlingPoints count={56} minRadius={0.12} maxRadius={0.78} opacity={0.56} />
      <SwirlingPoints count={38} minRadius={1.55} maxRadius={1.94} opacity={0.2} />
    </>
  );
}
