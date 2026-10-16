import { useWakeWord } from "@/components/lord/WakeWordProvider";

/** Lightweight, transparent SVG hologram used as the command center centerpiece. */
export function LordOrb() {
  const { state } = useWakeWord();
  const orbState = state === "disabled" ? "idle" : state;

  return (
    <div
      className="lord-orb-host relative isolate h-56 w-56 sm:h-72 sm:w-72 md:h-[390px] md:w-[390px]"
      data-state={orbState}
      role="img"
      aria-label={`LORD AI holographic core, ${orbState}`}
    >
      <svg
        className="lord-orb-svg absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="coreAura">
            <stop stopColor="#F4FFFF" stopOpacity="1" />
            <stop offset=".1" stopColor="#A9FBFF" stopOpacity=".8" />
            <stop offset=".28" stopColor="#65E7FF" stopOpacity=".46" />
            <stop offset=".5" stopColor="#32BFFF" stopOpacity=".2" />
            <stop offset="1" stopColor="#1787FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="coreGlass" cx=".38" cy=".3" r=".72">
            <stop stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset=".11" stopColor="#D2FFFF" stopOpacity=".94" />
            <stop offset=".3" stopColor="#8BF3FF" stopOpacity=".76" />
            <stop offset=".62" stopColor="#35C6FF" stopOpacity=".4" />
            <stop offset=".88" stopColor="#1675ED" stopOpacity=".18" />
            <stop offset="1" stopColor="#56DFFF" stopOpacity=".52" />
          </radialGradient>
          <linearGradient
            id="ringBlue"
            x1="30"
            y1="130"
            x2="370"
            y2="270"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3EAFFF" stopOpacity="0" />
            <stop offset=".22" stopColor="#70DFFF" stopOpacity=".76" />
            <stop offset=".52" stopColor="#E4FFFF" stopOpacity=".95" />
            <stop offset=".78" stopColor="#348BFF" stopOpacity=".68" />
            <stop offset="1" stopColor="#397EFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="ringCyan"
            x1="80"
            y1="60"
            x2="320"
            y2="340"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#A6F9FF" stopOpacity="0" />
            <stop offset=".3" stopColor="#72EAFF" stopOpacity=".8" />
            <stop offset=".58" stopColor="#D6FFFF" stopOpacity=".88" />
            <stop offset="1" stopColor="#318DFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="ringViolet"
            x1="40"
            y1="350"
            x2="350"
            y2="50"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#527FFF" stopOpacity="0" />
            <stop offset=".36" stopColor="#70D8FF" stopOpacity=".54" />
            <stop offset=".58" stopColor="#D7F9FF" stopOpacity=".76" />
            <stop offset="1" stopColor="#5E83FF" stopOpacity="0" />
          </linearGradient>
          <filter
            id="softGlow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="coreGlow"
            x="-120%"
            y="-120%"
            width="340%"
            height="340%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        {/* Diffuse light has no panel or rectangular backdrop. */}
        <circle
          cx="200"
          cy="200"
          r="166"
          fill="url(#coreAura)"
          filter="url(#coreGlow)"
          opacity=".82"
        />

        <g className="orbital-spin orbital-spin-slow">
          <ellipse
            cx="200"
            cy="200"
            rx="158"
            ry="54"
            stroke="url(#ringBlue)"
            strokeWidth="1.15"
            opacity=".78"
            transform="rotate(-24 200 200)"
          />
          <ellipse
            cx="200"
            cy="200"
            rx="158"
            ry="54"
            stroke="#58BFFF"
            strokeWidth="5"
            opacity=".11"
            filter="url(#softGlow)"
            transform="rotate(-24 200 200)"
          />
          <circle
            className="orb-particle orb-particle-delay-1"
            cx="350"
            cy="137"
            r="3.2"
            fill="#E8FFFF"
            filter="url(#softGlow)"
          />
          <circle cx="350" cy="137" r="1.5" fill="#F4FFFF" />
          <circle
            className="orb-particle"
            cx="70"
            cy="260"
            r="2.1"
            fill="#63DFFF"
            filter="url(#softGlow)"
          />
        </g>

        <g className="orbital-spin orbital-spin-reverse">
          <ellipse
            cx="200"
            cy="200"
            rx="151"
            ry="78"
            stroke="url(#ringCyan)"
            strokeWidth=".9"
            opacity=".72"
            transform="rotate(58 200 200)"
          />
          <circle
            className="orb-particle orb-particle-delay-2"
            cx="271"
            cy="62"
            r="2.7"
            fill="#E9FFFF"
            filter="url(#softGlow)"
          />
          <circle cx="271" cy="62" r="1.2" fill="#FFFFFF" />
        </g>

        <g className="orbital-spin orbital-spin-mid">
          <ellipse
            cx="200"
            cy="200"
            rx="169"
            ry="39"
            stroke="url(#ringBlue)"
            strokeWidth=".8"
            opacity=".52"
            transform="rotate(18 200 200)"
          />
          <circle
            className="orb-particle orb-particle-delay-3"
            cx="362"
            cy="250"
            r="1.8"
            fill="#A4F6FF"
            filter="url(#softGlow)"
          />
        </g>

        <g className="orbital-spin orbital-spin-wide">
          <ellipse
            cx="200"
            cy="200"
            rx="166"
            ry="91"
            stroke="url(#ringViolet)"
            strokeWidth=".72"
            opacity=".44"
            transform="rotate(-69 200 200)"
          />
          <circle cx="286" cy="326" r="1.8" fill="#DDFBFF" filter="url(#softGlow)" />
        </g>

        {/* Restrained surface arcs and an illuminated glass-like core. */}
        <circle
          cx="200"
          cy="200"
          r="58"
          fill="url(#coreAura)"
          filter="url(#coreGlow)"
          className="orb-core-pulse"
        />
        <g className="orb-core-pulse">
          <circle cx="200" cy="200" r="43" fill="url(#coreAura)" opacity=".62" />
          <circle cx="200" cy="200" r="37" stroke="#8DEEFF" strokeWidth=".7" opacity=".42" />
          <circle cx="200" cy="200" r="32" fill="url(#coreGlass)" opacity=".92" />
          <path
            d="M175 188c9-18 33-25 50-13"
            stroke="#F0FFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity=".9"
            filter="url(#softGlow)"
          />
          <path
            d="M169 199c2-18 14-34 30-39"
            stroke="#BDFBFF"
            strokeWidth="1"
            strokeLinecap="round"
            opacity=".54"
          />
          <path
            d="M174 216c13 17 37 20 54 7"
            stroke="#79E7FF"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity=".65"
          />
          <circle cx="200" cy="200" r="12" fill="#DDFEFF" opacity=".88" filter="url(#softGlow)" />
          <circle cx="200" cy="200" r="6" fill="#FFFFFF" />
        </g>

        <g fill="#A5F4FF" filter="url(#softGlow)">
          <circle cx="122" cy="145" r="1.4" />
          <circle cx="278" cy="169" r="1.2" />
          <circle cx="156" cy="278" r="1.1" />
          <circle cx="246" cy="287" r="1.5" />
          <circle cx="98" cy="214" r="1" />
        </g>
      </svg>
    </div>
  );
}
