import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { InnerCore } from "./InnerCore";
import { ParticleField } from "./ParticleField";

const vertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uTime;

  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash33(i + vec3(0.0,0.0,0.0)), f - vec3(0.0,0.0,0.0)),
                       dot(hash33(i + vec3(1.0,0.0,0.0)), f - vec3(1.0,0.0,0.0)), u.x),
                   mix(dot(hash33(i + vec3(0.0,1.0,0.0)), f - vec3(0.0,1.0,0.0)),
                       dot(hash33(i + vec3(1.0,1.0,0.0)), f - vec3(1.0,1.0,0.0)), u.x), u.y),
               mix(mix(dot(hash33(i + vec3(0.0,0.0,1.0)), f - vec3(0.0,0.0,1.0)),
                       dot(hash33(i + vec3(1.0,0.0,1.0)), f - vec3(1.0,0.0,1.0)), u.x),
                   mix(dot(hash33(i + vec3(0.0,1.0,1.0)), f - vec3(0.0,1.0,1.0)),
                       dot(hash33(i + vec3(1.0,1.0,1.0)), f - vec3(1.0,1.0,1.0)), u.x), u.y), u.z);
  }

  void main() {
    vec3 p = position;
    float slowField = noise3(p * 2.6 + vec3(uTime * 0.035, -uTime * 0.024, uTime * 0.019));
    float midField = noise3(p * 5.1 + vec3(-uTime * 0.047, uTime * 0.031, uTime * 0.026));
    float fineField = noise3(p * 10.0 + vec3(uTime * 0.07, uTime * 0.052, -uTime * 0.061));
    float displacement = slowField * 0.026 + midField * 0.012 + fineField * 0.004;
    p += normal * displacement;
    vPosition = p;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uTime;

  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = dot(hash33(i), f);
    float b = dot(hash33(i + vec3(1.0,0.0,0.0)), f - vec3(1.0,0.0,0.0));
    float c = dot(hash33(i + vec3(0.0,1.0,0.0)), f - vec3(0.0,1.0,0.0));
    float d = dot(hash33(i + vec3(1.0,1.0,0.0)), f - vec3(1.0,1.0,0.0));
    float e = dot(hash33(i + vec3(0.0,0.0,1.0)), f - vec3(0.0,0.0,1.0));
    float f1 = dot(hash33(i + vec3(1.0,0.0,1.0)), f - vec3(1.0,0.0,1.0));
    float g = dot(hash33(i + vec3(0.0,1.0,1.0)), f - vec3(0.0,1.0,1.0));
    float h = dot(hash33(i + vec3(1.0,1.0,1.0)), f - vec3(1.0,1.0,1.0));
    return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),mix(mix(e,f1,u.x),mix(g,h,u.x),u.y),u.z);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);
    float flow = noise3(vPosition * 4.0 + vec3(uTime * 0.045, -uTime * 0.035, uTime * 0.026));
    float fine = noise3(vPosition * 9.0 + vec3(-uTime * 0.07, uTime * 0.05, uTime * 0.06));
    float filament = smoothstep(0.46, 0.72, flow + fine * 0.19);
    float innerSheen = smoothstep(0.14, 0.9, flow) * 0.16;
    vec3 deepBlue = vec3(0.018, 0.105, 0.34);
    vec3 ice = vec3(0.27, 0.78, 1.0);
    vec3 color = mix(deepBlue, ice, clamp(fresnel * 0.82 + filament * 0.56, 0.0, 1.0));
    float alpha = 0.045 + fresnel * 0.22 + filament * 0.075 + innerSheen;
    vec3 emission = color * (0.26 + fresnel * 2.4 + filament * 1.7);
    gl_FragColor = vec4(emission, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function GlassSphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    [],
  );
  const materialRef = useRef(material);
  useFrame(({ clock }) => {
    materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.96, 112, 112]} />
        <primitive object={material} attach="material" />
      </mesh>
      <ParticleField />
      <InnerCore />
    </group>
  );
}
