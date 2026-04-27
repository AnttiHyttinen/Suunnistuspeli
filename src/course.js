import { DIFFICULTY_PROFILES } from "./config.js";

const EARTH_RADIUS_METERS = 6371008.8;
const METERS_PER_DEGREE_LAT = 111320;
const TAU = Math.PI * 2;

export function generateCourse(start, options) {
  const distanceKm = clamp(Number(options.distanceKm), 0.1, 20);
  const controlCount = Math.round(clamp(Number(options.controlCount), 1, 24));
  const difficulty = Math.round(clamp(Number(options.difficulty), 1, 3));
  const targetMeters = distanceKm * 1000;
  const profile = DIFFICULTY_PROFILES[difficulty];
  const unitCourse = buildUnitCourse(controlCount, profile);
  const finishMeters = fixedFinishOffset(unitCourse.finish, targetMeters);
  const scale = solveControlScale(unitCourse.controls, finishMeters, targetMeters);

  const controls = unitCourse.controls.map((point, index) => ({
    id: `C${index + 1}`,
    type: "control",
    label: `Rasti ${index + 1}`,
    order: index + 1,
    ...offsetToLatLng(start, point.x * scale, point.y * scale),
  }));

  const finish = {
    id: "F",
    type: "finish",
    label: "Maali",
    order: controlCount + 1,
    ...offsetToLatLng(start, finishMeters.x, finishMeters.y),
  };

  const routePoints = [start, ...controls, finish];

  return {
    id: createId("course"),
    createdAt: new Date().toISOString(),
    parameters: {
      requestedDistanceKm: Number(distanceKm.toFixed(1)),
      controlCount,
      difficulty,
    },
    plannedDistanceMeters: Math.round(routeDistanceMeters(routePoints)),
    start: {
      id: "S",
      type: "start",
      label: "Lähtö",
      lat: start.lat,
      lng: start.lng,
    },
    controls,
    finish,
  };
}

export function getCourseTargets(course) {
  if (!course) {
    return [];
  }

  return [...course.controls, course.finish];
}

export function getCourseRoute(course) {
  if (!course) {
    return [];
  }

  return [course.start, ...course.controls, course.finish];
}

export function distanceMeters(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeDistanceMeters(points) {
  return points.reduce((total, point, index) => {
    if (index === 0) {
      return 0;
    }

    return total + distanceMeters(points[index - 1], point);
  }, 0);
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) {
    return "-";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

function buildUnitCourse(controlCount, profile) {
  const start = { x: 0, y: 0 };
  const baseAngle = Math.random() * TAU;
  const aspectX = 0.86 + Math.random() * profile.aspectNoise;
  const aspectY = 0.86 + Math.random() * profile.aspectNoise;
  const controls = [];

  for (let index = 0; index < controlCount; index += 1) {
    const progress = (index + 1) / (controlCount + 1);
    const angle =
      baseAngle +
      progress * TAU +
      randomBetween(-profile.jitter, profile.jitter) +
      Math.sin(progress * Math.PI * 3) * profile.twist;
    const radius = 1 + randomBetween(-profile.radiusNoise, profile.radiusNoise);
    controls.push({
      x: Math.cos(angle) * radius * aspectX,
      y: Math.sin(angle) * radius * aspectY,
    });
  }

  const finishAngle = baseAngle + randomBetween(-0.45, 0.45);
  const finishRadius = 0.28 + profile.twist * 0.55;
  const finish = {
    x: Math.cos(finishAngle) * finishRadius,
    y: Math.sin(finishAngle) * finishRadius,
  };

  return {
    start,
    controls,
    finish,
    points: [start, ...controls, finish],
  };
}

function fixedFinishOffset(finishUnit, targetMeters) {
  const finishLength = Math.hypot(finishUnit.x, finishUnit.y) || 1;
  const nearDistance =
    targetMeters < 200 ? targetMeters * 0.12 : clamp(targetMeters * 0.08, 25, 220);

  return {
    x: (finishUnit.x / finishLength) * nearDistance,
    y: (finishUnit.y / finishLength) * nearDistance,
  };
}

function solveControlScale(unitControls, finishMeters, targetMeters) {
  let low = 1;
  let high = Math.max(25, targetMeters);

  while (planeRouteDistanceAtScale(unitControls, finishMeters, high) < targetMeters) {
    high *= 1.6;
  }

  for (let index = 0; index < 42; index += 1) {
    const middle = (low + high) / 2;
    if (planeRouteDistanceAtScale(unitControls, finishMeters, middle) < targetMeters) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
}

function planeRouteDistanceAtScale(unitControls, finishMeters, scale) {
  const start = { x: 0, y: 0 };
  const controls = unitControls.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));

  return polylineDistanceInPlane([start, ...controls, finishMeters]);
}

function offsetToLatLng(origin, xMeters, yMeters) {
  const lat = origin.lat + yMeters / METERS_PER_DEGREE_LAT;
  const lng =
    origin.lng +
    xMeters / (METERS_PER_DEGREE_LAT * Math.cos(toRadians(origin.lat)));

  return { lat, lng };
}

function polylineDistanceInPlane(points) {
  return points.reduce((total, point, index) => {
    if (index === 0) {
      return 0;
    }

    const previous = points[index - 1];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    return total + Math.hypot(dx, dy);
  }, 0);
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
