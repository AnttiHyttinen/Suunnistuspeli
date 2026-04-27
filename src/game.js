import { CHECK_RADIUS_METERS, START_RADIUS_METERS } from "./config.js";
import {
  distanceMeters,
  formatDistance,
  getCourseTargets,
  routeDistanceMeters,
} from "./course.js";

export const GameStatus = {
  planning: "planning",
  ready: "ready",
  playing: "playing",
  finished: "finished",
};

export const FinishReason = {
  completed: "completed",
  aborted: "aborted",
  loaded: "loaded",
};

export class OrienteeringGame {
  constructor({ onChange, onNotify } = {}) {
    this.onChange = onChange;
    this.onNotify = onNotify;
    this.state = createInitialState();
  }

  getState() {
    return {
      ...this.state,
      targets: getCourseTargets(this.state.course),
      visibleTrack: this.getVisibleTrack(),
      elapsedMillis: this.getElapsedMillis(),
    };
  }

  setStart(position) {
    this.state.start = {
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy,
      source: position.source || "GPS",
      timestamp: position.timestamp || Date.now(),
    };
    this.emitChange();
  }

  setCourse(course) {
    this.state = {
      ...createInitialState(),
      start: this.state.start,
      course,
      status: GameStatus.ready,
    };
    this.emitChange();
  }

  loadCourse(course) {
    this.state = {
      ...createInitialState(),
      start: course?.start || null,
      course,
      status: course ? GameStatus.ready : GameStatus.planning,
    };
    this.emitChange();
  }

  loadResult(result) {
    const startedAt = parseTime(result.startedAt);
    const finishedAt = parseTime(result.finishedAt);
    const track = Array.isArray(result.recordedRoute) ? result.recordedRoute : [];
    const visits = Array.isArray(result.visits) ? result.visits : [];

    this.state = {
      ...createInitialState(),
      status: GameStatus.finished,
      start: result.course?.start || null,
      course: result.course,
      activeIndex: visits.length,
      startedAt,
      finishedAt: finishedAt || Date.now(),
      lastSplitAt: finishedAt || startedAt,
      visibleUntil: finishedAt || Date.now(),
      latestPosition: track.at(-1) || null,
      track,
      visits,
      finishReason: result.finishReason || FinishReason.loaded,
    };
    this.emitChange();
  }

  start(currentPosition) {
    if (!this.state.course || this.state.status === GameStatus.playing) {
      return false;
    }

    if (!currentPosition) {
      this.onNotify?.("GPS-sijainti puuttuu. Pelin voi aloittaa vasta lähtöpisteessä.");
      return false;
    }

    const startDistance = distanceMeters(currentPosition, this.state.course.start);
    if (startDistance > START_RADIUS_METERS) {
      this.onNotify?.(
        `Pelin voi aloittaa vasta lähtöpisteessä. Olet ${formatDistance(startDistance)} päässä lähdöstä.`,
      );
      return false;
    }

    const now = Date.now();
    this.state.status = GameStatus.playing;
    this.state.startedAt = now;
    this.state.lastSplitAt = now;
    this.state.activeIndex = 0;
    this.state.visits = [];
    this.state.track = [];
    this.state.visibleUntil = null;
    this.state.latestPosition = currentPosition;
    this.state.finishReason = null;

    this.recordPosition({ ...currentPosition, timestamp: now }, { force: true });

    this.onNotify?.("Peli alkoi. Sijainti piilotettiin kartalta.");
    this.emitChange();
    return true;
  }

  updatePosition(position, options = {}) {
    this.state.latestPosition = position;

    if (this.state.status === GameStatus.playing) {
      this.recordPosition(position, options);
    }

    this.emitChange();
  }

  handleTargetClick(targetId) {
    if (this.state.status !== GameStatus.playing) {
      this.onNotify?.("Aloita peli ennen rastien kuittaamista.");
      return;
    }

    const targets = getCourseTargets(this.state.course);
    const target = targets[this.state.activeIndex];

    if (!target) {
      return;
    }

    if (target.id !== targetId) {
      this.onNotify?.(`${target.label} on seuraavana.`);
      return;
    }

    const currentPosition = this.state.latestPosition;
    if (!currentPosition) {
      this.onNotify?.("GPS-sijainti puuttuu. Odota paikannusta ja yritä uudelleen.");
      return;
    }

    const distance = distanceMeters(currentPosition, target);
    if (distance > CHECK_RADIUS_METERS) {
      this.onNotify?.(`Olet vielä ${formatDistance(distance)} päässä: ${target.label}.`);
      return;
    }

    const now = Date.now();
    this.recordPosition({ ...currentPosition, timestamp: now }, { force: true });

    const visit = {
      id: target.id,
      label: target.label,
      type: target.type,
      visitedAt: new Date(now).toISOString(),
      splitMillis: now - this.state.lastSplitAt,
      cumulativeMillis: now - this.state.startedAt,
      distanceFromTargetMeters: Math.round(distance),
      trackDistanceMeters: Math.round(routeDistanceMeters(this.state.track)),
    };

    this.state.visits.push(visit);
    this.state.visibleUntil = now;
    this.state.lastSplitAt = now;
    this.state.activeIndex += 1;

    if (target.type === "finish") {
      this.state.status = GameStatus.finished;
      this.state.finishedAt = now;
      this.state.finishReason = FinishReason.completed;
      this.onNotify?.("Maali löytyi. Peli päättyi.");
    } else {
      const next = targets[this.state.activeIndex];
      this.onNotify?.(`Olet rastilla: ${target.label}. Seuraava on ${next.label}.`);
    }

    this.emitChange();
  }

  abort(currentPosition) {
    if (this.state.status !== GameStatus.playing) {
      return false;
    }

    const now = Date.now();
    const position = currentPosition || this.state.latestPosition;

    if (position) {
      this.state.latestPosition = position;
      this.recordPosition({ ...position, timestamp: now }, { force: true });
    }

    this.state.status = GameStatus.finished;
    this.state.finishedAt = now;
    this.state.finishReason = FinishReason.aborted;
    this.state.visibleUntil = now;
    this.onNotify?.("Suunnistus keskeytettiin. Reitti tähän saakka näytetään kartalla.");
    this.emitChange();
    return true;
  }

  getVisibleTrack() {
    if (this.state.status === GameStatus.finished) {
      return this.state.track;
    }

    if (!this.state.visibleUntil) {
      return [];
    }

    return this.state.track.filter((point) => point.timestamp <= this.state.visibleUntil);
  }

  getElapsedMillis() {
    if (!this.state.startedAt) {
      return 0;
    }

    const end = this.state.finishedAt || Date.now();
    return end - this.state.startedAt;
  }

  recordPosition(position, options = {}) {
    if (!position || options.recorded === false) {
      return;
    }

    const previous = this.state.track.at(-1);
    const duplicate =
      previous &&
      previous.lat === position.lat &&
      previous.lng === position.lng &&
      previous.timestamp === position.timestamp;

    if (!duplicate || options.force) {
      this.state.track.push({
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        timestamp: position.timestamp || Date.now(),
      });
    }
  }

  emitChange() {
    this.onChange?.(this.getState());
  }
}

function createInitialState() {
  return {
    status: GameStatus.planning,
    start: null,
    course: null,
    activeIndex: 0,
    startedAt: null,
    finishedAt: null,
    lastSplitAt: null,
    visibleUntil: null,
    latestPosition: null,
    track: [],
    visits: [],
    finishReason: null,
  };
}

function parseTime(value) {
  if (!value) {
    return null;
  }

  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
