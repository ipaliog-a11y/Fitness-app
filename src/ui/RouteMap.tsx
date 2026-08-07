/**
 * The route, drawn on OpenStreetMap tiles.
 *
 * Tiles are fetched only when the detail screen asks for them, and the track is
 * drawn whether or not they arrive — offline, the line renders on a plain
 * background rather than showing nothing. That fallback is the point: this app
 * is meant to work in a forest with no signal.
 */

import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../core/geo';
import {
  fitBounds,
  tileUrl,
  toScreen,
  visibleTiles,
  TILE_ATTRIBUTION,
  TILE_SIZE,
  type MapView,
} from '../core/mercator';

interface Props {
  segments: GeoPoint[][];
  /** Optional ghost / planned route drawn under the live track. */
  ghostSegments?: GeoPoint[][];
  /**
   * Latest GPS fix (including pre-start / not-yet-accepted points). Used to
   * centre the live map before two track points exist.
   */
  position?: GeoPoint | null;
  /** Fetch map tiles. Off gives the bare track on a flat background. */
  tiles?: boolean;
  /** Marks the newest point, for a run in progress. */
  live?: boolean;
  /** Empty-state copy when there is nothing to centre on yet. */
  emptyLabel?: string;
}

/**
 * Tiles are cached across mounts, so flicking between runs does not re-fetch
 * the same neighbourhood repeatedly. Bounded, because an unbounded image cache
 * on a long-lived page is a memory leak with extra steps.
 */
const tileCache = new Map<string, HTMLImageElement>();
const TILE_CACHE_LIMIT = 200;

function loadTile(url: string): Promise<HTMLImageElement | null> {
  const cached = tileCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const image = new Image();
    // Tiles are drawn to a canvas that is never read back, so this is only
    // about letting the browser reuse them without tainting anything.
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (tileCache.size >= TILE_CACHE_LIMIT) {
        const oldest = tileCache.keys().next().value;
        if (oldest) tileCache.delete(oldest);
      }
      tileCache.set(url, image);
      resolve(image);
    };
    // Offline, or a tile server having a bad day: the track still draws.
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function pointCount(segments: GeoPoint[][]): number {
  return segments.reduce((n, s) => n + s.length, 0);
}

export function RouteMap({
  segments,
  ghostSegments,
  position = null,
  tiles = true,
  live = false,
  emptyLabel = 'No route recorded',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // The canvas is sized in CSS but drawn in device pixels, so it has to be
  // measured rather than assumed. Read once immediately so the first paint is
  // not stuck waiting for a ResizeObserver frame after mount.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const apply = (width: number, height: number) => {
      if (width > 0 && height > 0) setSize({ width, height });
    };
    const rect = element.getBoundingClientRect();
    apply(rect.width, rect.height);

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      apply(width, height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const allForBounds = [...segments, ...(ghostSegments ?? [])];
    if (position) allForBounds.push([position]);
    const view = fitBounds(allForBounds, size.width, size.height, 22);
    // `cancelled` stops a slow tile from painting over a map the user has
    // already navigated away from.
    let cancelled = false;

    const drawPolyline = (
      segs: GeoPoint[][],
      stroke: string,
      width: number,
      dash?: number[],
    ) => {
      if (!view) return;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dash ?? []);
      for (const segment of segs) {
        if (segment.length < 2) continue;
        const points = segment.map((p) => toScreen(p.lat, p.lon, view));
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = width + 3;
        ctx.beginPath();
        points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.beginPath();
        points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };

    const marker = (point: GeoPoint, fill: string, radius: number, v: MapView) => {
      const [x, y] = toScreen(point.lat, point.lon, v);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0e1116';
      ctx.stroke();
    };

    const drawTrack = (v: MapView) => {
      if (ghostSegments && ghostSegments.length > 0) {
        drawPolyline(ghostSegments, '#64748b', 3, [8, 6]);
      }

      // A dark casing under the bright line keeps it legible over both pale
      // streets and dark parkland.
      drawPolyline(segments, '#4ade80', 3.5);

      const first = segments.find((s) => s.length > 0)?.[0];
      const lastSegment = [...segments].reverse().find((s) => s.length > 0);
      const last = lastSegment?.[lastSegment.length - 1];
      // Prefer the freshest GPS reading for the live "you are here" dot.
      const here = position ?? last;

      if (first && first !== here) marker(first, '#e8edf4', 5, v);
      if (here) marker(here, live ? '#4ade80' : '#f87171', live ? 7 : 5, v);
      else if (first) marker(first, live ? '#4ade80' : '#e8edf4', live ? 7 : 5, v);
    };

    if (!view) {
      ctx.fillStyle = '#1e242e';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = '#93a0b3';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emptyLabel, size.width / 2, size.height / 2);
      return;
    }

    ctx.fillStyle = '#1e242e';
    ctx.fillRect(0, 0, size.width, size.height);

    if (!tiles) {
      drawTrack(view);
      return;
    }

    // Draw the track immediately, then again over the tiles as they land, so
    // the route is visible from the first frame instead of after the network.
    drawTrack(view);

    void Promise.all(
      visibleTiles(view).map(async (tile) => {
        const image = await loadTile(tileUrl(tile));
        return { tile, image };
      }),
    ).then((results) => {
      if (cancelled) return;
      ctx.fillStyle = '#1e242e';
      ctx.fillRect(0, 0, size.width, size.height);

      // OSM's standard style is light; dimming it keeps the app dark and makes
      // the green track the brightest thing on screen.
      ctx.globalAlpha = 0.72;
      for (const { tile, image } of results) {
        if (image) ctx.drawImage(image, tile.left, tile.top, TILE_SIZE, TILE_SIZE);
      }
      ctx.globalAlpha = 1;

      drawTrack(view);
    });

    return () => {
      cancelled = true;
    };
  }, [segments, ghostSegments, position, size, tiles, live, emptyLabel]);

  const waiting =
    live &&
    pointCount(segments) === 0 &&
    !(ghostSegments && pointCount(ghostSegments) > 0) &&
    !position;

  return (
    <div className={`map${live ? ' map-live' : ''}${waiting ? ' map-waiting' : ''}`} ref={containerRef}>
      <canvas ref={canvasRef} />
      {tiles && <div className="attribution">{TILE_ATTRIBUTION}</div>}
    </div>
  );
}
