import { useEffect, useState, type CSSProperties } from "react";

/**
 * ParticleField - Animated background particle effect
 */
export function ParticleField() {
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; duration: number; delay: number }>
  >([]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const count = reduced ? 0 : coarse ? 6 : 12;
    // Initialize particles
    const initialParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 18 + Math.random() * 24,
      delay: -Math.random() * 30,
    }));
    setParticles(initialParticles);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <svg className="h-full w-full" aria-hidden="true">
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r="0.5"
            fill="var(--hud)"
            opacity="0.055"
            className="ambient-particle"
            style={
              {
                "--particle-duration": `${p.duration}s`,
                "--particle-delay": `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </svg>
    </div>
  );
}
