import { getCourseRoute, routeDistanceMeters } from "./course.js";

export function saveBlankCourse(course) {
  const payload = {
    type: "orienteering-course",
    version: 1,
    savedAt: new Date().toISOString(),
    course,
    route: null,
    visits: [],
  };

  downloadJson(payload, fileName("tyhja-rata", course));
}

export function saveCompletedCourse(state) {
  const payload = {
    type: "orienteering-result",
    version: 1,
    savedAt: new Date().toISOString(),
    course: state.course,
    plannedRoute: getCourseRoute(state.course),
    plannedDistanceMeters: state.course?.plannedDistanceMeters || 0,
    recordedRoute: state.track,
    recordedDistanceMeters: Math.round(routeDistanceMeters(state.track)),
    visits: state.visits,
    startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    finishedAt: state.finishedAt ? new Date(state.finishedAt).toISOString() : null,
    elapsedMillis: state.elapsedMillis,
  };

  downloadJson(payload, fileName("suunnistettu-rata", state.course));
}

function downloadJson(payload, name) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileName(prefix, course) {
  const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const id = course?.id?.slice(-8) || "rata";
  return `${prefix}-${date}-${id}.json`;
}
