import {
  TRACK_MIN_DISTANCE_METERS,
  TRACK_MIN_INTERVAL_MS,
} from "./config.js";
import { distanceMeters } from "./course.js";

export class GeoTracker {
  constructor({ onPosition, onError } = {}) {
    this.onPosition = onPosition;
    this.onError = onError;
    this.watchId = null;
    this.lastPosition = null;
  }

  isSupported() {
    return "geolocation" in navigator;
  }

  async getCurrentPosition() {
    if (!this.isSupported()) {
      throw new Error("Selain ei tue paikannusta.");
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, geoOptions());
    });

    const normalized = normalizePosition(position);
    this.lastPosition = normalized;
    this.onPosition?.(normalized);
    return normalized;
  }

  start() {
    if (!this.isSupported() || this.watchId !== null) {
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const normalized = normalizePosition(position);
        if (shouldAcceptTrackPoint(this.lastPosition, normalized)) {
          this.lastPosition = normalized;
          this.onPosition?.(normalized);
        } else {
          this.lastPosition = normalized;
          this.onPosition?.(normalized, { recorded: false });
        }
      },
      (error) => this.onError?.(humanizeGeoError(error)),
      geoOptions(),
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getLastPosition() {
    return this.lastPosition;
  }
}

export function createManualPosition(point, label = "Kartta") {
  return {
    lat: point.lat,
    lng: point.lng,
    accuracy: null,
    timestamp: Date.now(),
    source: label,
  };
}

function normalizePosition(position) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp || Date.now(),
    source: "GPS",
  };
}

function shouldAcceptTrackPoint(previous, next) {
  if (!previous) {
    return true;
  }

  const movedEnough = distanceMeters(previous, next) >= TRACK_MIN_DISTANCE_METERS;
  const waitedEnough =
    Math.abs(next.timestamp - previous.timestamp) >= TRACK_MIN_INTERVAL_MS;
  return movedEnough || waitedEnough;
}

function geoOptions() {
  return {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 12000,
  };
}

function humanizeGeoError(error) {
  if (!error) {
    return "Paikannus ei onnistunut.";
  }

  if (error.code === error.PERMISSION_DENIED) {
    return "Paikannus estettiin selaimessa.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Sijaintia ei saatu juuri nyt.";
  }

  if (error.code === error.TIMEOUT) {
    return "Paikannus aikakatkaistiin.";
  }

  return error.message || "Paikannus ei onnistunut.";
}
