/**
 * Web Mercator, enough of it to put a route on a slippy map.
 *
 * The same projection Google, OSM and everyone else's raster tiles use, so a
 * track drawn with these numbers lands exactly where the streets are.
 */

import type { MessageKey } from '../i18n';

import { boundsOf, type GeoPoint } from './geo';
/*
 * Type-only, and deliberately so: settings.ts imports parseMapStyle from here,
 * so a value import back would be a real cycle. `import type` is erased at
 * compile time, which keeps this honest about ThemeId instead of restating the
 * union — the previous inline copy silently went stale every time a theme was
 * added.
 */
import type { ThemeId } from './settings';

/** Tile-space coordinates at a given zoom: integer part is the tile, fraction is the offset inside it. */
export interface TilePoint {
  x: number;
  y: number;
}

export const TILE_SIZE = 256;

export function project(lat: number, lon: number, zoom: number): TilePoint {
  const scale = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    // The Mercator y term. Latitude is clamped by the formula itself: it runs to
    // infinity at the poles, which is why web maps stop at about 85 degrees.
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  };
}

export interface MapView {
  zoom: number;
  /** Tile-space coordinate at the centre of the viewport. */
  centre: TilePoint;
  widthPx: number;
  heightPx: number;
}

/**
 * The view that fits a track into a viewport, with a margin.
 *
 * Zoom is chosen as the largest integer that still fits, because raster tiles
 * only exist at integer zooms and drawing a scaled tile is visibly soft.
 */
export function fitBounds(
  segments: GeoPoint[][],
  widthPx: number,
  heightPx: number,
  paddingPx = 24,
  maxZoom = 17,
): MapView | null {
  const bounds = boundsOf(segments);
  if (!bounds) return null;

  const usableWidth = Math.max(32, widthPx - paddingPx * 2);
  const usableHeight = Math.max(32, heightPx - paddingPx * 2);

  let zoom = maxZoom;
  for (; zoom > 0; zoom--) {
    const topLeft = project(bounds.maxLat, bounds.minLon, zoom);
    const bottomRight = project(bounds.minLat, bounds.maxLon, zoom);
    const spanX = (bottomRight.x - topLeft.x) * TILE_SIZE;
    const spanY = (bottomRight.y - topLeft.y) * TILE_SIZE;
    if (spanX <= usableWidth && spanY <= usableHeight) break;
  }

  const centre = project(
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLon + bounds.maxLon) / 2,
    zoom,
  );

  return { zoom, centre, widthPx, heightPx };
}

/** Where a coordinate lands in the viewport, in pixels from the top-left. */
export function toScreen(lat: number, lon: number, view: MapView): [number, number] {
  const p = project(lat, lon, view.zoom);
  return [
    (p.x - view.centre.x) * TILE_SIZE + view.widthPx / 2,
    (p.y - view.centre.y) * TILE_SIZE + view.heightPx / 2,
  ];
}

export interface TileRef {
  x: number;
  y: number;
  z: number;
  /** Where the tile's top-left corner sits in the viewport. */
  left: number;
  top: number;
}

/** Every tile needed to cover the viewport. */
export function visibleTiles(view: MapView): TileRef[] {
  const scale = 2 ** view.zoom;
  const halfTilesX = view.widthPx / 2 / TILE_SIZE;
  const halfTilesY = view.heightPx / 2 / TILE_SIZE;

  const minX = Math.floor(view.centre.x - halfTilesX);
  const maxX = Math.floor(view.centre.x + halfTilesX);
  const minY = Math.floor(view.centre.y - halfTilesY);
  const maxY = Math.floor(view.centre.y + halfTilesY);

  const tiles: TileRef[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      // Above the north edge or below the south edge there is no tile to fetch.
      if (y < 0 || y >= scale) continue;
      tiles.push({
        // Longitude wraps, so a view straddling the antimeridian still resolves
        // to real tiles rather than negative ones.
        x: ((x % scale) + scale) % scale,
        y,
        z: view.zoom,
        left: (x - view.centre.x) * TILE_SIZE + view.widthPx / 2,
        top: (y - view.centre.y) * TILE_SIZE + view.heightPx / 2,
      });
    }
  }
  return tiles;
}

/**
 * Basemap skins (raster tiles in Web Mercator).
 *
 * `auto` is resolved against the app theme before fetch: Daylight → standard,
 * Soft/HUD → dark. No API keys — free public layers with required attribution.
 */
export type MapStyleId = 'auto' | 'standard' | 'dark' | 'terrain';
export type MapBasemapId = 'standard' | 'dark' | 'terrain';

export const MAP_STYLE_OPTIONS: Array<{
  id: MapStyleId;
  label: MessageKey;
  blurb: MessageKey;
}> = [
  {
    id: 'auto',
    label: 'mapStyle.auto.label',
    blurb: 'mapStyle.auto.blurb',
  },
  {
    id: 'standard',
    label: 'mapStyle.standard.label',
    blurb: 'mapStyle.standard.blurb',
  },
  {
    id: 'dark',
    label: 'mapStyle.dark.label',
    blurb: 'mapStyle.dark.blurb',
  },
  {
    id: 'terrain',
    label: 'mapStyle.terrain.label',
    blurb: 'mapStyle.terrain.blurb',
  },
];

export function parseMapStyle(value: unknown): MapStyleId {
  if (value === 'standard' || value === 'osm' || value === 'light') return 'standard';
  if (value === 'dark' || value === 'dark-matter' || value === 'carto-dark') return 'dark';
  if (value === 'terrain' || value === 'topo' || value === 'opentopo') return 'terrain';
  if (value === 'auto' || value === 'theme' || value === 'match') return 'auto';
  return 'auto';
}

/** Pick a concrete basemap from style + UI theme. */
export function resolveMapBasemap(style: MapStyleId, theme: ThemeId): MapBasemapId {
  // Only Daylight is a light theme; everything else wants a dark basemap.
  if (style === 'auto') return theme === 'day' ? 'standard' : 'dark';
  return style;
}

export interface MapBasemapInfo {
  id: MapBasemapId;
  /** How hard to dim tiles under the route (1 = full brightness). */
  tileDim: number;
  attribution: string;
  url(tile: TileRef): string;
}

/**
 * Tile templates for each basemap.
 *
 * Standard OSM is fine for personal low volume; dark uses Carto CDN free
 * basemaps; terrain uses OpenTopoMap. Attribution is always shown on the map.
 */
export const MAP_BASEMAPS: Record<MapBasemapId, MapBasemapInfo> = {
  standard: {
    id: 'standard',
    tileDim: 0.72,
    attribution: '© OpenStreetMap contributors',
    url: (tile) => `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`,
  },
  dark: {
    id: 'dark',
    // Already dark — little dimming so labels stay readable.
    tileDim: 0.92,
    attribution: '© OpenStreetMap © CARTO',
    url: (tile) =>
      `https://basemaps.cartocdn.com/dark_all/${tile.z}/${tile.x}/${tile.y}.png`,
  },
  terrain: {
    id: 'terrain',
    tileDim: 0.85,
    attribution: '© OpenStreetMap, SRTM · © OpenTopoMap (CC-BY-SA)',
    url: (tile) => `https://tile.opentopomap.org/${tile.z}/${tile.x}/${tile.y}.png`,
  },
};

/** @deprecated Prefer basemap.url — kept for older call sites. */
export function tileUrl(tile: TileRef, basemap: MapBasemapId = 'standard'): string {
  return MAP_BASEMAPS[basemap].url(tile);
}

export const TILE_ATTRIBUTION = MAP_BASEMAPS.standard.attribution;
