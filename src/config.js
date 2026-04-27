export const CHECK_RADIUS_METERS = 10;
export const TRACK_MIN_DISTANCE_METERS = 2;
export const TRACK_MIN_INTERVAL_MS = 2500;

export const DEFAULT_CENTER = {
  lat: 60.1699,
  lng: 24.9384,
};

export const MAP_LAYERS = {
  openTopo: {
    label: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
  },
  osm: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  mmlTopo: {
    label: "MML Maastokartta",
    url: ({ apiKey }) => {
      const suffix = apiKey ? `?api-key=${encodeURIComponent(apiKey)}` : "";
      return `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png${suffix}`;
    },
    options: {
      maxZoom: 16,
      attribution:
        '&copy; <a href="https://www.maanmittauslaitos.fi/">Maanmittauslaitos</a>, avoimet kartta-aineistot CC BY 4.0',
    },
  },
};

export const DIFFICULTY_PROFILES = {
  1: {
    jitter: 0.08,
    radiusNoise: 0.1,
    aspectNoise: 0.12,
    twist: 0.05,
  },
  2: {
    jitter: 0.18,
    radiusNoise: 0.22,
    aspectNoise: 0.22,
    twist: 0.14,
  },
  3: {
    jitter: 0.34,
    radiusNoise: 0.36,
    aspectNoise: 0.34,
    twist: 0.28,
  },
};
