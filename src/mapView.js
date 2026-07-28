import { DEFAULT_CENTER, MAP_LAYERS } from "./config.js";
import { getCourseRoute, getCourseTargets } from "./course.js";

const COURSE_PURPLE = "#b000b8";
const TOUCH_TAP_TOLERANCE_PX = 14;

export class MapView {
  constructor(
    elementId,
    {
      initialBearing = 0,
      onBearingChange,
      onTargetClick,
      onCoursePointMove,
      onCoursePointSelect,
    } = {},
  ) {
    this.onBearingChange = onBearingChange;
    this.onTargetClick = onTargetClick;
    this.onCoursePointMove = onCoursePointMove;
    this.onCoursePointSelect = onCoursePointSelect;
    this.rotationSupported = typeof L.Map.prototype.setBearing === "function";
    this.courseEditingActive = false;
    this.bearingBeforeCourseEditing = 0;
    this.touchRotateWasEnabled = false;
    this.selectedCoursePointId = null;
    this.coursePointMarkers = new Map();
    this.map = L.map(elementId, {
      zoomControl: true,
      preferCanvas: false,
      rotate: this.rotationSupported,
      bearing: normalizeBearing(initialBearing),
      touchRotate: this.rotationSupported,
      shiftKeyRotate: this.rotationSupported,
      rotateControl: false,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14);

    this.baseLayer = null;
    this.vectorRenderer = L.svg({ padding: 0.5 });
    this.courseRenderSignature = null;
    this.trackLine = null;
    this.courseLayer = L.layerGroup().addTo(this.map);
    this.trackLayer = L.layerGroup().addTo(this.map);
    this.userLayer = L.layerGroup().addTo(this.map);
    if (this.rotationSupported) {
      this.map.on("rotate", () => this.emitBearingChange(false));
      this.map.on("rotateend", () => this.emitBearingChange(true));
    }
    this.map.on("click", (event) => this.handleCoursePlacement(event));
    this.bindTouchCoursePointSelection();
    this.setBaseLayer("openTopo");
  }

  supportsRotation() {
    return this.rotationSupported;
  }

  getBearing() {
    if (!this.rotationSupported) {
      return 0;
    }

    return normalizeBearing(this.map.getBearing());
  }

  setBearing(bearing, { committed = true } = {}) {
    if (!this.rotationSupported) {
      return false;
    }

    this.map.setBearing(normalizeBearing(bearing));
    this.emitBearingChange(committed);
    return true;
  }

  rotateBy(degrees) {
    return this.setBearing(this.getBearing() + degrees);
  }

  emitBearingChange(committed) {
    this.onBearingChange?.(this.getBearing(), { committed });
  }

  setCourseEditing(active) {
    const nextActive = Boolean(active);
    if (nextActive === this.courseEditingActive) {
      return;
    }

    this.courseEditingActive = nextActive;
    if (!nextActive) {
      this.clearCoursePointSelection();
    }

    if (!this.rotationSupported) {
      return;
    }

    if (nextActive) {
      this.bearingBeforeCourseEditing = this.getBearing();
      this.touchRotateWasEnabled = Boolean(this.map.touchRotate?.enabled?.());
      this.map.touchRotate?.disable?.();
      this.setBearing(0, { committed: false });
      return;
    }

    if (this.touchRotateWasEnabled) {
      this.map.touchRotate?.enable?.();
    }
    this.setBearing(this.bearingBeforeCourseEditing, { committed: false });
  }

  bindTouchCoursePointSelection() {
    const container = this.map.getContainer();
    const selectFromEvent = (event) => {
      if (!this.courseEditingActive) {
        return false;
      }

      const markerElement = event.target?.closest?.("[data-course-point-id]");
      if (!markerElement) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      this.selectCoursePoint(markerElement.dataset.coursePointId);
      return true;
    };

    if (window.PointerEvent) {
      container.addEventListener(
        "pointerdown",
        (event) => {
          if (event.pointerType !== "touch") {
            return;
          }

          selectFromEvent(event);
        },
        { capture: true, passive: false },
      );
      return;
    }

    container.addEventListener(
      "touchstart",
      (event) => {
        selectFromEvent(event);
      },
      { capture: true, passive: false },
    );
  }

  registerCoursePointMarker(marker, point) {
    const markerElement = marker.getElement();
    if (!markerElement) {
      return;
    }

    markerElement.dataset.coursePointId = point.id;
    this.coursePointMarkers.set(point.id, marker);
    markerElement.classList.toggle("is-selected", point.id === this.selectedCoursePointId);

    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      this.selectCoursePoint(point.id);
    });
  }

  registerGameTargetMarker(marker, target) {
    const markerElement = marker.getElement();
    if (!markerElement) {
      return;
    }

    markerElement.dataset.courseTargetId = target.id;
    markerElement.setAttribute("role", "button");
    markerElement.tabIndex = 0;

    let touchStart = null;
    let lastTouchActivation = 0;
    const activate = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      this.onTargetClick?.(target.id);
    };

    if (window.PointerEvent) {
      markerElement.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        touchStart = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        try {
          markerElement.setPointerCapture?.(event.pointerId);
        } catch {
          // The marker stays stable during play, so capture is only an extra safeguard.
        }
      });
      markerElement.addEventListener("pointerup", (event) => {
        if (event.pointerType !== "touch" || !touchStart) {
          return;
        }

        const start = touchStart;
        touchStart = null;
        if (event.pointerId !== start.pointerId) {
          return;
        }

        const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (movement <= TOUCH_TAP_TOLERANCE_PX) {
          lastTouchActivation = Date.now();
          activate(event);
        }
      });
      markerElement.addEventListener("pointercancel", () => {
        touchStart = null;
      });
    } else {
      markerElement.addEventListener(
        "touchstart",
        (event) => {
          const touch = event.changedTouches?.[0];
          if (!touch) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          touchStart = { x: touch.clientX, y: touch.clientY };
        },
        { passive: false },
      );
      markerElement.addEventListener(
        "touchend",
        (event) => {
          const touch = event.changedTouches?.[0];
          if (!touch || !touchStart) {
            return;
          }

          const start = touchStart;
          touchStart = null;
          const movement = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
          if (movement <= TOUCH_TAP_TOLERANCE_PX) {
            lastTouchActivation = Date.now();
            activate(event);
          }
        },
        { passive: false },
      );
      markerElement.addEventListener("touchcancel", () => {
        touchStart = null;
      });
    }

    markerElement.addEventListener("click", (event) => {
      if (Date.now() - lastTouchActivation < 700) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      activate(event);
    });
    markerElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });
  }

  selectCoursePoint(pointId) {
    if (!this.courseEditingActive || !this.coursePointMarkers.has(pointId)) {
      return;
    }

    this.selectedCoursePointId = pointId;
    this.coursePointMarkers.forEach((marker, id) => {
      marker.getElement()?.classList.toggle("is-selected", id === pointId);
    });
    this.map.getContainer().classList.add("is-course-point-selected");

    const point = this.coursePointMarkers.get(pointId);
    this.onCoursePointSelect?.(point?.options?.alt || "Piste");
  }

  clearCoursePointSelection() {
    this.selectedCoursePointId = null;
    this.coursePointMarkers.forEach((marker) => {
      marker.getElement()?.classList.remove("is-selected");
    });
    this.map.getContainer().classList.remove("is-course-point-selected");
  }

  handleCoursePlacement(event) {
    if (!this.courseEditingActive || !this.selectedCoursePointId) {
      return;
    }

    if (event.originalEvent?.target?.closest?.("[data-course-point-id]")) {
      return;
    }

    const pointId = this.selectedCoursePointId;
    const position = event.latlng;
    this.clearCoursePointSelection();
    this.onCoursePointMove?.(pointId, {
      lat: position.lat,
      lng: position.lng,
    });
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
    const renderSignature = createCourseRenderSignature(course, state);
    if (renderSignature === this.courseRenderSignature) {
      return;
    }
    this.courseRenderSignature = renderSignature;

    this.courseLayer.clearLayers();
    this.coursePointMarkers.clear();

    if (!course) {
      this.clearCoursePointSelection();
      return;
    }

    const route = getCourseRoute(course);
    const latLngs = route.map((point) => [point.lat, point.lng]);
    const routeLine = L.polyline(latLngs, {
      pane: "overlayPane",
      renderer: this.vectorRenderer,
      color: COURSE_PURPLE,
      weight: 4,
      opacity: 0.95,
      lineCap: "butt",
      lineJoin: "round",
      interactive: false,
    }).addTo(this.courseLayer);

    const startClassName = [
      state.startedAt ? "visited" : "",
      state.editingCourse ? "editing" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const startMarker = L.marker([course.start.lat, course.start.lng], {
      icon: createStartIcon(startClassName),
      pane: "markerPane",
      zIndexOffset: 500,
      draggable: state.editingCourse,
      autoPan: false,
      title: state.editingCourse ? "Raahaa lähtöpistettä" : "Lähtö",
      alt: "Lähtö",
    }).addTo(this.courseLayer);
    if (state.editingCourse) {
      this.registerCoursePointMarker(startMarker, course.start);
      this.bindCoursePointDrag(startMarker, course.start, course, routeLine);
    }

    const targets = getCourseTargets(course);
    targets.forEach((target, index) => {
      const isVisited = state.visits.some((visit) => visit.id === target.id);
      const isActive =
        state.status === "playing" && index === state.activeIndex && !isVisited;
      const className = [
        target.type === "finish" ? "finish" : "",
        isVisited ? "visited" : "",
        isActive ? "active" : "",
        state.editingCourse ? "editing" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label = target.type === "finish" ? "" : String(target.order);
      const marker = L.marker([target.lat, target.lng], {
        icon:
          target.type === "finish"
            ? createFinishIcon(className)
            : createControlIcon(label, className),
        pane: "markerPane",
        zIndexOffset: isActive ? 800 : 600,
        draggable: state.editingCourse,
        autoPan: false,
        title: state.editingCourse ? `Raahaa: ${target.label}` : target.label,
        alt: target.label,
      }).addTo(this.courseLayer);

      if (state.editingCourse) {
        this.registerCoursePointMarker(marker, target);
        this.bindCoursePointDrag(marker, target, course, routeLine);
      } else {
        this.registerGameTargetMarker(marker, target);
      }
    });
  }

  bindCoursePointDrag(marker, point, course, routeLine) {
    if (!marker.dragging?.enabled()) {
      return;
    }

    let dragActive = false;
    let interactionPrepared = false;
    let pointMoved = false;
    let latestLatLng = null;
    let suspendedHandlers = [];

    const suspendHandler = (handler) => {
      const wasEnabled = Boolean(handler?.enabled?.());
      if (wasEnabled) {
        handler.disable();
      }
      return { handler, wasEnabled };
    };

    const restoreMapGestures = () => {
      suspendedHandlers.forEach(({ handler, wasEnabled }) => {
        if (wasEnabled) {
          handler?.enable?.();
        }
      });
      suspendedHandlers = [];
      this.map.getContainer().classList.remove("is-course-point-dragging");
    };

    const removeDocumentListeners = () => {
      document.removeEventListener("pointerup", finishDrag);
      document.removeEventListener("pointercancel", finishDrag);
      document.removeEventListener("mouseup", finishDrag);
      document.removeEventListener("touchend", finishDrag);
      document.removeEventListener("touchcancel", finishDrag);
    };

    const finishDrag = () => {
      if (!interactionPrepared && !dragActive) {
        return;
      }

      const shouldCommit = dragActive && pointMoved && latestLatLng;
      dragActive = false;
      interactionPrepared = false;
      marker.getElement()?.classList.remove("is-dragging");
      removeDocumentListeners();
      restoreMapGestures();

      if (!shouldCommit) {
        return;
      }

      this.clearCoursePointSelection();
      this.onCoursePointMove?.(point.id, {
        lat: latestLatLng.lat,
        lng: latestLatLng.lng,
      });
    };

    const prepareInteraction = (event) => {
      if (interactionPrepared) {
        return;
      }

      interactionPrepared = true;
      event?.stopPropagation?.();
      this.map.getContainer().classList.add("is-course-point-dragging");
      suspendedHandlers = [
        suspendHandler(this.map.dragging),
        suspendHandler(this.map.touchZoom),
        suspendHandler(this.map.touchRotate),
      ];
      document.addEventListener("pointerup", finishDrag, { once: true });
      document.addEventListener("pointercancel", finishDrag, { once: true });
      document.addEventListener("mouseup", finishDrag, { once: true });
      document.addEventListener("touchend", finishDrag, { once: true, passive: true });
      document.addEventListener("touchcancel", finishDrag, {
        once: true,
        passive: true,
      });
    };

    const markerElement = marker.getElement();
    markerElement?.classList.add("is-touch-draggable");
    markerElement?.addEventListener("pointerdown", prepareInteraction, {
      capture: true,
      passive: true,
    });
    markerElement?.addEventListener("touchstart", prepareInteraction, {
      capture: true,
      passive: true,
    });
    markerElement?.addEventListener("mousedown", prepareInteraction, {
      capture: true,
      passive: true,
    });

    marker.on("dragstart", () => {
      prepareInteraction();
      dragActive = true;
      pointMoved = false;
      latestLatLng = marker.getLatLng();
      marker.getElement()?.classList.add("is-dragging");
    });

    marker.on("drag", (event) => {
      const latLng = event.target.getLatLng();
      pointMoved = true;
      latestLatLng = latLng;
      const draggedRoute = getCourseRoute(course).map((routePoint) =>
        routePoint.id === point.id
          ? [latLng.lat, latLng.lng]
          : [routePoint.lat, routePoint.lng],
      );
      routeLine.setLatLngs(draggedRoute);
    });

    marker.on("dragend", finishDrag);
    marker.on("remove", () => {
      markerElement?.removeEventListener("pointerdown", prepareInteraction, true);
      markerElement?.removeEventListener("touchstart", prepareInteraction, true);
      markerElement?.removeEventListener("mousedown", prepareInteraction, true);
      removeDocumentListeners();
      restoreMapGestures();
    });
  }

  drawVisibleTrack(points) {
    if (!points || points.length < 2) {
      if (this.trackLine) {
        this.trackLayer.removeLayer(this.trackLine);
        this.trackLine = null;
      }
      return;
    }

    const latLngs = points.map((point) => [point.lat, point.lng]);
    if (this.trackLine) {
      this.trackLine.setLatLngs(latLngs);
      return;
    }

    this.trackLine = L.polyline(latLngs, {
      pane: "overlayPane",
      renderer: this.vectorRenderer,
      color: "#16835a",
      weight: 5,
      opacity: 0.82,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    }).addTo(this.trackLayer);
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

function createStartIcon(className = "") {
  const symbolSize = 52;
  const iconSize = className.includes("editing") ? 64 : symbolSize;
  return L.divIcon({
    className: "course-marker",
    html: `
      <svg class="course-symbol course-symbol-start ${escapeHtml(className)}" width="${symbolSize}" height="${symbolSize}" viewBox="0 0 ${symbolSize} ${symbolSize}" aria-hidden="true">
        <polygon points="26,6 48,44 4,44"></polygon>
      </svg>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2 + 4],
  });
}

function createControlIcon(label, className = "") {
  const symbolSize = className.includes("active") ? 54 : 48;
  const iconSize = className.includes("editing") ? 62 : symbolSize;
  const radius = className.includes("active") ? 19 : 17;
  return L.divIcon({
    className: "course-marker",
    html: `
      <svg class="course-symbol course-symbol-control ${escapeHtml(className)}" width="${symbolSize}" height="${symbolSize}" viewBox="0 0 ${symbolSize} ${symbolSize}" aria-hidden="true">
        <circle cx="${symbolSize / 2}" cy="${symbolSize / 2}" r="${radius}"></circle>
        <text x="${symbolSize / 2}" y="${symbolSize / 2 + 5}" text-anchor="middle">${escapeHtml(label)}</text>
      </svg>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  });
}

function createFinishIcon(className = "") {
  const symbolSize = className.includes("active") ? 58 : 52;
  const iconSize = className.includes("editing") ? 64 : symbolSize;
  return L.divIcon({
    className: "course-marker",
    html: `
      <svg class="course-symbol course-symbol-finish ${escapeHtml(className)}" width="${symbolSize}" height="${symbolSize}" viewBox="0 0 ${symbolSize} ${symbolSize}" aria-hidden="true">
        <circle cx="${symbolSize / 2}" cy="${symbolSize / 2}" r="${symbolSize * 0.32}"></circle>
        <circle cx="${symbolSize / 2}" cy="${symbolSize / 2}" r="${symbolSize * 0.22}"></circle>
      </svg>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
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

function normalizeBearing(value) {
  const bearing = Number(value);
  if (!Number.isFinite(bearing)) {
    return 0;
  }

  return Math.round(((bearing % 360) + 360) % 360);
}

function createCourseRenderSignature(course, state) {
  if (!course) {
    return "no-course";
  }

  return JSON.stringify({
    route: getCourseRoute(course).map((point) => [point.id, point.lat, point.lng]),
    status: state.status,
    editing: Boolean(state.editingCourse),
    started: Boolean(state.startedAt),
    activeIndex: state.activeIndex,
    visits: state.visits.map((visit) => visit.id),
  });
}
