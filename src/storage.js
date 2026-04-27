import { getCourseRoute, routeDistanceMeters } from "./course.js";

const STORAGE_KEY = "suunnistuspeli.savedItems.v1";

export const SavedItemType = {
  course: "course",
  result: "result",
};

export function listSavedItems() {
  return readItems().sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

export function getSavedItem(id) {
  return readItems().find((item) => item.id === id) || null;
}

export function saveBlankCourse(course, name) {
  const item = {
    id: createId("saved-course"),
    type: SavedItemType.course,
    name: cleanName(name, "Nimeton rata"),
    savedAt: new Date().toISOString(),
    payload: {
      type: "orienteering-course",
      version: 2,
      course,
      plannedRoute: getCourseRoute(course),
      plannedDistanceMeters: course?.plannedDistanceMeters || 0,
    },
  };

  return appendItem(item);
}

export function saveCompletedCourse(state, name) {
  const item = {
    id: createId("saved-result"),
    type: SavedItemType.result,
    name: cleanName(name, "Nimeton reitti"),
    savedAt: new Date().toISOString(),
    payload: {
      type: "orienteering-result",
      version: 2,
      course: state.course,
      plannedRoute: getCourseRoute(state.course),
      plannedDistanceMeters: state.course?.plannedDistanceMeters || 0,
      recordedRoute: state.track,
      recordedDistanceMeters: Math.round(routeDistanceMeters(state.track)),
      visits: state.visits,
      startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
      finishedAt: state.finishedAt ? new Date(state.finishedAt).toISOString() : null,
      elapsedMillis: state.elapsedMillis,
      finishReason: state.finishReason,
    },
  };

  return appendItem(item);
}

function appendItem(item) {
  const items = readItems();
  items.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return item;
}

function readItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isSavedItem) : [];
  } catch {
    return [];
  }
}

function isSavedItem(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.savedAt === "string" &&
    typeof item.type === "string" &&
    item.payload
  );
}

function cleanName(name, fallback) {
  const trimmed = String(name || "").trim();
  return trimmed || fallback;
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
