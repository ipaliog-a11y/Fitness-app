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
  MAP_BASEMAPS,
  toScreen,
  visibleTiles,
  TILE_SIZE,
  type MapBasemapId,
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
  /**
   * Basemap skin (already resolved from style + theme). Default standard OSM.
   */
  basemap?: MapBasemapId;
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

/**
 * The theme, sampled for the canvas.
 *
 * A canvas takes colour strings, not custom properties, so the tokens have to
 * be read out of the computed style each time we paint. Every one falls back to
 * the value it used to be hardcoded as, which is what the dark themes still
 * resolve to.
 */
function readPaint() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ground: token('--surface-2', '#1e242e'),
    route: token('--accent', '#4ade80'),
    casing: token('--map-casing', 'rgba(0,0,0,0.45)'),
    ring: token('--bg', '#0e1116'),
    start: token('--text', '#e8edf4'),
    finish: token('--danger', '#f87171'),
    ghost: token('--muted-2', '#64748b'),
    label: token('--muted', '#93a0b3'),
    // Theme can still override; basemap supplies its own default dim.
    tileDim: Number(token('--map-tile-dim', '')) || 0,
  };
}

export function RouteMap({
  segments,
  ghostSegments,
  position = null,
  tiles = true,
  basemap = 'standard',
  live = false,
  emptyLabel = 'No route recorded',
}: Props) {
  const basemapInfo = MAP_BASEMAPS[basemap] ?? MAP_BASEMAPS.standard;
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

  // Switching theme has to repaint the canvas; CSS alone cannot reach it.
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;

    const paint = readPaint();
    // Standard OSM is light — theme CSS dims it for Soft/HUD. Dark/terrain
    // basemaps already suit the screen; use their own dim so labels stay crisp.
    const tileDim =
      basemap === 'standard' && paint.tileDim > 0
        ? paint.tileDim
        : basemapInfo.tileDim;

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
        ctx.strokeStyle = paint.casing;
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
      ctx.strokeStyle = paint.ring;
      ctx.stroke();
    };

    const drawTrack = (v: MapView) => {
      if (ghostSegments && ghostSegments.length > 0) {
        drawPolyline(ghostSegments, paint.ghost, 3, [8, 6]);
      }

      // A casing under the line keeps it legible over both pale streets and
      // dark parkland; it flips with the theme so it always contrasts.
      drawPolyline(segments, paint.route, 3.5);

      const first = segments.find((s) => s.length > 0)?.[0];
      const lastSegment = [...segments].reverse().find((s) => s.length > 0);
      const last = lastSegment?.[lastSegment.length - 1];
      // Prefer the freshest GPS reading for the live "you are here" dot.
      const here = position ?? last;

      if (first && first !== here) marker(first, paint.start, 5, v);
      if (here) marker(here, live ? paint.route : paint.finish, live ? 7 : 5, v);
      else if (first) marker(first, live ? paint.route : paint.start, live ? 7 : 5, v);
    };

    if (!view) {
      ctx.fillStyle = paint.ground;
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = paint.label;
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emptyLabel, size.width / 2, size.height / 2);
      return;
    }

    ctx.fillStyle = paint.ground;
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
        const image = await loadTile(basemapInfo.url(tile));
        return { tile, image };
      }),
    ).then((results) => {
      if (cancelled) return;
      ctx.fillStyle = paint.ground;
      ctx.fillRect(0, 0, size.width, size.height);

      ctx.globalAlpha = tileDim;
      for (const { tile, image } of results) {
        if (image) ctx.drawImage(image, tile.left, tile.top, TILE_SIZE, TILE_SIZE);
      }
      ctx.globalAlpha = 1;

      drawTrack(view);
    });

    return () => {
      cancelled = true;
    };
    // themeTick is never read in the body — it is here so that switching theme
    // forces the repaint a canvas cannot get from CSS.
  }, [segments, ghostSegments, position, size, tiles, live, emptyLabel, themeTick, basemap, basemapInfo]);

  const waiting =
    live &&
    pointCount(segments) === 0 &&
    !(ghostSegments && pointCount(ghostSegments) > 0) &&
    !position;

  return (
    <div className={`map${live ? ' map-live' : ''}${waiting ? ' map-waiting' : ''}`} ref={containerRef}>
      <canvas ref={canvasRef} />
      {tiles && <div className="attribution">{basemapInfo.attribution}</div>}
    </div>
  );
}
