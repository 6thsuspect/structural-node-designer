import { useId } from 'react';

/**
 * App logo — an n8n-style mark on a dark-red rounded-square badge: a
 * circular hollow node on the left joins a stretched horizontal line
 * that splits into upper and lower branches, each running through a
 * stretched lead-in wire to its right node. The upper node is solid
 * white with a very thin outer ring; the lower node is a hollow white
 * ring (the n8n chain's first node is omitted). Used in the toolbar
 * (top-left), the splash screen and the About dialog. The browser
 * favicon (`public/favicon.svg`) is the same artwork.
 */
export default function AppLogo({ size = 28, title = 'Structural Node Designer' }: { size?: number; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `sndLogoBg${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C81E1E" />
          <stop offset="1" stopColor="#7F1D1D" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="14" fill={`url(#${gradId})`} stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5" />
      {/* connectors: stretched lead-in wires to the right upper and lower nodes */}
      <path d="M21 32 H32 C32 22 35 22 38 22 H44 M21 32 H32 C32 42 35 42 38 42 H44" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      {/* left node: circular ring */}
      <circle cx="16" cy="32" r="5.5" fill="none" stroke="#FFFFFF" strokeWidth="5" />
      {/* upper node: solid white with a very thin outer ring */}
      <circle cx="50" cy="22" r="5" fill="#FFFFFF" />
      <circle cx="50" cy="22" r="8" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.9" />
      {/* lower node: hollow ring */}
      <circle cx="50" cy="42" r="5.5" fill="none" stroke="#FFFFFF" strokeWidth="5" />
    </svg>
  );
}
