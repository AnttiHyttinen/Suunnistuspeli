import { DEFAULT_CENTER, MAP_LAYERS } from "./config.js";
import { getCourseRoute, getCourseTargets } from "./course.js";

const COURSE_PURPLE = "#b000b8";

export class MapView {
  constructor(elementId, { onTargetClick } = {}) {
    this.onTargetClick = onTargetClick;
    this.map = L.map(elementId, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14);

    this.baseLayer = null;
    this.map.createPane("coursePane");
    this.map.getPane("coursePane").style.zIndex = 625;
    this.courseLayer = L.layerGroup().addTo(this.map);
    this.trackLayer = L.layerGroup().addTo(this.map);
    this.userLayer = L.layerGroup().addTo(this.map);
    this.setBaseLayer("openTopo");
  }

  setBaseLayer(layerKey, apiKey = "") {
    const layerConfig = MAP_LAYERS[layerKey] || MAP_LAYERS.openTopo;
    const url =
      typeof layerConfig.url === "function" ? layerConfig.url({ apiKey }) : layerConfig.url;

    if (this.baseLayer) {
      this.map.removeLayer(this.baseLayer);
    }

    this.baseLayer = L.tileLayer(url, layerConfig.options).addTo(this.map);
  }

  getCenterPosition() {
    const center = this.map.getCenter();
    return { lat: center.lat, lng: center.lng };
  }

  setView(position, zoom = 15) {
    this.map.setView([position.lat, position.lng], zoom);
  }

  showUserLocation(position) {
    this.userLayer.clearLayers();
    if (!position) {
      return;
    }

    L.marker([position.lat, position.lng], {
      icon: L.divIcon({
        className: "",
        html: '<div class="user-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(this.userLayer);

    if (position.accuracy) {
      L.circle([position.lat, position.lng], {
        radius: position.accuracy,
        color: "#1f75cb",
        weight: 1,
        fillColor: "#1f75cb",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(this.userLayer);
    }
  }

  hideUserLocation() {
    this.userLayer.clearLayers();
  }

  drawCourse(course, state) {
    this.courseLayer.clearLayers();

    if (!course) {
      return;
    }

    const route = getCourseRoute(course);
    const latLngs = route.map((point) => [point.lat, point.lng]);
    L.polyline(latLngs, {
      pane: "coursePane",
      color: COURSE_PURPLE,
      weight: 4,
      opacity: 0.95,
      lineCap: "butt",
      lineJoin: "round",
    }).addTo(this.courseLayer);

    L.marker([course.start.lat, course.start.lng], {
      icon: createStartIcon(),
      pane: "coursePane",
      zIndexOffset: 500,
    }).addTo(this.courseLayer);

    const targets = getCourseTargets(course);
    targets.forEach((target, index) => {
      const isVisited = state.visits.some((visit) => visit.id === target.id);
      const isActive =
        state.status === "playing" && index === state.activeIndex && !isVisited;
      const className = [
        target.type === "finish" ? "finish" : "",
        isVisited ? "visited" : "",
        isActive ? "active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label = target.type === "finish" ? "" : String(target.order);
      const marker = L.marker([target.lat, target.lng], {
        icon:
          target.type === "finish"
            ? createFinishIcon(className)
            : createControlIcon(label, className),
        pane: "coursePane",
        zIndexOffset: isActive ? 800 : 600,
      }).addTo(this.courseLayer);

      marker.on("click", () => this.onTargetClick?.(target.id));
    });
  }

  drawVisibleTrack(points) {
    this.trackLayer.clearLayers();

    if (!points || points.length < 2) {
      return;
    }

    L.polyline(
      points.map((point) => [point.lat, point.lng]),
      {
        color: "#16835a",
        weight: 5,
        opacity: 0.82,
        lineCap: "round",
        lineJoin: "round",
      },
    ).addTo(this.trackLayer);
  }

  fitCourse(course) {
    if (!course) {
      return;
    }

    const bounds = L.latLngBounds(
      getCourseRoute(course).map((point) => [point.lat, point.lng]),
    );
    this.map.fitBounds(bounds.pad(0.22), { maxZoom: 16 });
  }

  refreshSize() {
    this.map.invalidateSize();
  }
}

function createStartIcon() {
  const size = 52;
  return L.divIcon({
    className: "course-marker",
    html: `
      <svg class="course-symbol course-symbol-start" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <polygon points="26,6 48,44 4,44"></polygon>
      </svg>
    `,
    iconSize: [size, size],
    iconAnchor: [26, 30],
  });
}

function createControlIcon(label, className = "") {
  const size = className.includes("active") ? 54 : 48;
  const radius = className.includes("active") ? 19 : 17;
  return L.divIcon({
    className: "course-marker",
    html: `
      <svg class="course-symbol course-symbol-control ${escapeHtml(className)}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"></circle>
        <text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle">${escapeHtml(label)}</text>
      </svg>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createFinishIcon(className = "") {
  const size = className.includes("active") ? 58 : 52;
  return L.divIcon({
    className: "course-marker",
    html: `
      <svg class="course-symbol course-symbol-finish ${escapeHtml(className)}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.32}"></circle>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.22}"></circle>
      </svg>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
