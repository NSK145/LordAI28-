import { useEffect, useRef, useState } from "react";
import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { GlassSphere } from "./GlassSphere";
import { GlowEffect } from "./GlowEffect";
import { OrbitalRing } from "./OrbitalRing";

function OrbScene() {
  const core = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.PointLight>(null);

  useFrame(({ pointer, clock }, delta) => {
    const t = clock.elapsedTime;
    if (core.current) {
      const ease = 1 - Math.exp(-delta * 1.8);
      const idleX = Math.sin(t * 0.13 + Math.sin(t * 0.037)) * 0.008;
      const idleZ = Math.cos(t * 0.097 + Math.sin(t * 0.051)) * 0.008;
      const tiltX = THREE.MathUtils.clamp(-pointer.y * 0.052 + idleX, -0.075, 0.075);
      const tiltZ = THREE.MathUtils.clamp(pointer.x * 0.052 + idleZ, -0.075, 0.075);
      core.current.rotation.x += (tiltX - core.current.rotation.x) * ease;
      core.current.rotation.z += (tiltZ - core.current.rotation.z) * ease;
      core.current.rotation.y += delta * 0.026;
      const breath = 1 + (0.5 + 0.5 * Math.sin(t * 0.19 + Math.sin(t * 0.047) * 1.3)) * 0.016;
      core.current.scale.setScalar(breath);
    }
    if (keyLight.current) {
      keyLight.current.position.x +=
        (2.0 + pointer.x * 0.24 - keyLight.current.position.x) * (1 - Math.exp(-delta * 1.3));
      keyLight.current.position.y +=
        (1.6 + pointer.y * 0.2 - keyLight.current.position.y) * (1 - Math.exp(-delta * 1.3));
    }
  });

  return (
    <>
      <ambientLight intensity={0.28} color="#8dbbff" />
      <hemisphereLight args={["#a7eaff", "#07142d", 0.42]} />
      <pointLight
        ref={keyLight}
        position={[2, 1.6, 2.8]}
        color="#8adfff"
        intensity={4.6}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[-1.8, -1.2, -2]}
        color="#176bff"
        intensity={5.5}
        distance={7}
        decay={2}
      />
      <pointLight
        position={[0, 0.5, -2.1]}
        color="#48bfff"
        intensity={3.2}
        distance={5}
        decay={2}
      />
      <group ref={core}>
        <GlassSphere />
        <GlowEffect />
        <OrbitalRing radius={1.27} rotation={[0.92, 0.2, 0.36]} speed={0.19} phase={0.31} />
        <OrbitalRing radius={1.37} rotation={[-0.72, 0.51, -0.46]} speed={-0.137} phase={1.47} />
        <OrbitalRing radius={1.46} rotation={[0.24, 0.88, 0.08]} speed={0.103} phase={2.83} />
        <OrbitalRing radius={1.53} rotation={[1.14, -0.44, 0.68]} speed={-0.079} phase={4.19} />
      </group>
    </>
  );
}

export function LordOrb() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motionPreference.matches);
    updateMotion();
    motionPreference.addEventListener("change", updateMotion);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(host);
    return () => {
      motionPreference.removeEventListener("change", updateMotion);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="LORD AI's living blue plasma core, surrounded by four independently moving energy orbits"
      className="lord-orb-host relative isolate h-[288px] w-[288px] sm:h-[322px] sm:w-[322px] md:h-[390px] md:w-[390px]"
    >
      <Canvas
        frameloop={visible && !reducedMotion ? "always" : "never"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4.95], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <OrbScene />
        <AdaptiveDpr pixelated />
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.05} luminanceThreshold={0.22} luminanceSmoothing={0.72} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
