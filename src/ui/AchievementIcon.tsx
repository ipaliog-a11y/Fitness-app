/**
 * Small SVG icons for achievements — one glyph per AchievementIconId.
 */

import type { AchievementIconId } from '../core/achievements';

interface Props {
  id: AchievementIconId;
  className?: string;
}

export function AchievementIcon({ id, className }: Props) {
  const common = {
    className: className ?? 'achievement-icon-svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (id) {
    case 'flag':
      return (
        <svg {...common}>
          <path d="M5 21V4" />
          <path d="M5 4h10l-2 4 2 4H5" />
        </svg>
      );
    case 'shoe':
      return (
        <svg {...common}>
          <path d="M4 15c2 0 3-1 5-1s3 2 6 2 5-1 5-1l-1 3H5l-1-3z" />
          <path d="M7 14V9c0-1 1-2 3-2h1" />
        </svg>
      );
    case 'shoes':
      return (
        <svg {...common}>
          <path d="M3 16c2 0 2.5-1 4.5-1S10 17 13 17s5-1 5-1l-1 3H4l-1-3z" />
          <path d="M8 12c1.5 0 2 1 3.5 1s3-1.5 5.5-1.5" />
        </svg>
      );
    case 'medal':
      return (
        <svg {...common}>
          <circle cx="12" cy="14" r="5" />
          <path d="M9 9 8 3h8l-1 6" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
          <path d="M7 6H5a2 2 0 0 0 2 4" />
          <path d="M17 6h2a2 2 0 0 1-2 4" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 3c2 4-2 5 0 9 3-2 5-5 5-8 3 3 3 8 0 11a6 6 0 1 1-12 0c0-4 3-7 7-12z" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" />
          <path d="M5 19c2-6 6-10 12-12" />
        </svg>
      );
    case 'mountain':
      return (
        <svg {...common}>
          <path d="m3 18 6-10 3 5 3-4 6 9H3z" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6 6 0 0 0 20 14.5z" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.4 5.5L20 9.5l-4 4.2L17.2 20 12 16.8 6.8 20 8 13.7l-4-4.2 5.6-1L12 3z" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case 'coach':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
          <path d="M16 4.5 18 3" />
        </svg>
      );
    case 'note':
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6V3z" />
          <path d="M15 3v4h4M8 11h8M8 15h6" />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 2 5 13h6l-1 9 9-13h-6l0-7z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case 'gym':
      return (
        <svg {...common}>
          <path d="M6 8v8M18 8v8M9 10v4M15 10v4M6 12h12" />
        </svg>
      );
    case 'path':
      return (
        <svg {...common}>
          <path d="M5 19c3-2 4-6 4-8s0-4 3-5 4 1 4 3-1 4 2 6 4 0 4 0" />
        </svg>
      );
    case 'crown':
      return (
        <svg {...common}>
          <path d="m3 17 3-10 4 5 2-7 2 7 4-5 3 10H3z" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M4.5 7.5l2.5 2.5M17 14l2.5 2.5M3 12h4M17 12h4M4.5 16.5 7 14M17 10l2.5-2.5" />
        </svg>
      );
    case 'watch':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 9v4l2 1M9 4h6M9 20h6" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case 'route':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="M8 7c4 0 4 4 8 4s4 4 4 5" />
        </svg>
      );
    case 'timer':
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="7" />
          <path d="M12 10v4l2 1M10 3h4" />
        </svg>
      );
    case 'ribbon':
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="m9 13-2 8 5-3 5 3-2-8" />
        </svg>
      );
    case 'compass':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m15 9-2 6-6 2 2-6 6-2z" />
        </svg>
      );
    case 'gift':
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="10" rx="1" />
          <path d="M12 10v10M4 14h16M12 10c-2-3-5-2-5 0s3 2 5 2 5-1 5-2-3-3-5 0z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}
