import {
  distanceMeters,
  formatDistance,
  formatDuration,
  getCourseTargets,
  routeDistanceMeters,
} from "./course.js";
import { START_RADIUS_METERS } from "./config.js";
import { GameStatus } from "./game.js";

export class UI {
  constructor() {
    this.elements = {
      distanceInput: document.querySelector("#distanceInput"),
      controlCountInput: document.querySelector("#controlCountInput"),
      difficultyButtons: document.querySelector("#difficultyButtons"),
      mapLayerSelect: document.querySelector("#mapLayerSelect"),
      mmlApiKeyInput: document.querySelector("#mmlApiKeyInput"),
      locateButton: document.querySelector("#locateButton"),
      centerStartButton: document.querySelector("#centerStartButton"),
      generateButton: document.querySelector("#generateButton"),
      editCourseButton: document.querySelector("#editCourseButton"),
      courseEditHint: document.querySelector("#courseEditHint"),
      startButton: document.querySelector("#startButton"),
      headerStatePill: document.querySelector("#headerStatePill"),
      startPointText: document.querySelector("#startPointText"),
      startReadinessText: document.querySelector("#startReadinessText"),
      floatingAbortButton: document.querySelector("#floatingAbortButton"),
      mapRotationControls: document.querySelector("#mapRotationControls"),
      rotateMapLeftButton: document.querySelector("#rotateMapLeftButton"),
      resetMapRotationButton: document.querySelector("#resetMapRotationButton"),
      rotateMapRightButton: document.querySelector("#rotateMapRightButton"),
      mapCompassNeedle: document.querySelector("#mapCompassNeedle"),
      mapBearingText: document.querySelector("#mapBearingText"),
      mapInfo: document.querySelector("#mapInfo"),
      mapInfoTitle: document.querySelector("#mapInfoTitle"),
      mapInfoText: document.querySelector("#mapInfoText"),
      playHud: document.querySelector("#playHud"),
      hudTimerText: document.querySelector("#hudTimerText"),
      hudNextTargetText: document.querySelector("#hudNextTargetText"),
      hudProgressText: document.querySelector("#hudProgressText"),
      hudProgressBar: document.querySelector("#hudProgressBar"),
      abortModal: document.querySelector("#abortModal"),
      abortCancelButton: document.querySelector("#abortCancelButton"),
      abortConfirmButton: document.querySelector("#abortConfirmButton"),
      saveModal: document.querySelector("#saveModal"),
      saveNameInput: document.querySelector("#saveNameInput"),
      saveCancelButton: document.querySelector("#saveCancelButton"),
      saveConfirmButton: document.querySelector("#saveConfirmButton"),
      saveBlankButton: document.querySelector("#saveBlankButton"),
      saveResultButton: document.querySelector("#saveResultButton"),
      savedCountText: document.querySelector("#savedCountText"),
      savedItemsSelect: document.querySelector("#savedItemsSelect"),
      loadSavedButton: document.querySelector("#loadSavedButton"),
      courseDistanceBadge: document.querySelector("#courseDistanceBadge"),
      timerText: document.querySelector("#timerText"),
      gameStatusText: document.querySelector("#gameStatusText"),
      gpsStatusText: document.querySelector("#gpsStatusText"),
      nextTargetText: document.querySelector("#nextTargetText"),
      trackPointText: document.querySelector("#trackPointText"),
      visitedCountText: document.querySelector("#visitedCountText"),
      sidebarProgressBar: document.querySelector("#sidebarProgressBar"),
      controlsList: document.querySelector("#controlsList"),
      splitsTableBody: document.querySelector("#splitsTableBody"),
      finishText: document.querySelector("#finishText"),
      resultSummary: document.querySelector("#resultSummary"),
      resultTitle: document.querySelector("#resultTitle"),
      resultTimeText: document.querySelector("#resultTimeText"),
      resultDistanceText: document.querySelector("#resultDistanceText"),
      resultControlsText: document.querySelector("#resultControlsText"),
      resultLead: document.querySelector("#resultLead"),
      toast: document.querySelector("#toast"),
    };
    this.toastTimer = null;
  }

  bind(actions) {
    this.elements.difficultyButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-difficulty]");
      if (!button) {
        return;
      }

      this.elements.difficultyButtons
        .querySelectorAll("button")
        .forEach((item) => item.classList.toggle("selected", item === button));
    });

    this.elements.mapLayerSelect.addEventListener("change", () => {
      actions.onLayerChange?.(this.getLayerSettings());
    });

    this.elements.mmlApiKeyInput.addEventListener("input", () => {
      actions.onLayerChange?.(this.getLayerSettings());
    });

    this.elements.locateButton.addEventListener("click", () => actions.onLocate?.());
    this.elements.centerStartButton.addEventListener("click", () =>
      actions.onUseCenter?.(),
    );
    this.elements.generateButton.addEventListener("click", () =>
      actions.onGenerate?.(this.getCourseSettings()),
    );
    this.elements.editCourseButton.addEventListener("click", () =>
      actions.onEditCourse?.(),
    );
    this.elements.startButton.addEventListener("click", () => actions.onStart?.());
    this.elements.floatingAbortButton.addEventListener("click", () => actions.onStart?.());
    this.elements.rotateMapLeftButton.addEventListener("click", () =>
      actions.onRotateMapLeft?.(),
    );
    this.elements.resetMapRotationButton.addEventListener("click", () =>
      actions.onResetMapRotation?.(),
    );
    this.elements.rotateMapRightButton.addEventListener("click", () =>
      actions.onRotateMapRight?.(),
    );
    this.elements.saveBlankButton.addEventListener("click", () =>
      actions.onSaveBlank?.(),
    );
    this.elements.saveResultButton.addEventListener("click", () =>
      actions.onSaveResult?.(),
    );
    this.elements.loadSavedButton.addEventListener("click", () =>
      actions.onLoadSaved?.(this.getSelectedSavedId()),
    );
  }

  getCourseSettings() {
    const selectedDifficulty = this.elements.difficultyButtons.querySelector(".selected");
    return {
      distanceKm: Number(this.elements.distanceInput.value),
      controlCount: Number(this.elements.controlCountInput.value),
      difficulty: Number(selectedDifficulty?.dataset.difficulty || 1),
    };
  }

  getLayerSettings() {
    return {
      layer: this.elements.mapLayerSelect.value,
      apiKey: this.elements.mmlApiKeyInput.value.trim(),
    };
  }

  setApiKey(value) {
    this.elements.mmlApiKeyInput.value = value || "";
  }

  setMapLayer(value) {
    this.elements.mapLayerSelect.value = value;
  }

  setMapRotationAvailable(available) {
    this.elements.mapRotationControls.hidden = !available;
  }

  setMapBearing(bearing) {
    const normalized = Math.round(((Number(bearing) % 360) + 360) % 360);
    this.elements.mapBearingText.textContent = `${normalized}°`;
    this.elements.mapCompassNeedle.style.transform = `rotate(${-normalized}deg)`;
    this.elements.resetMapRotationButton.setAttribute(
      "aria-label",
      `Palauta pohjoinen ylös. Kartan suunta ${normalized} astetta`,
    );
  }

  getSelectedSavedId() {
    return this.elements.savedItemsSelect.value;
  }

  askSaveName(defaultName) {
    return new Promise((resolve) => {
      const modal = this.elements.saveModal;
      const input = this.elements.saveNameInput;
      const cancelButton = this.elements.saveCancelButton;
      const confirmButton = this.elements.saveConfirmButton;
      const previousFocus = document.activeElement;

      const cleanup = (result) => {
        modal.hidden = true;
        document.body.classList.remove("has-modal");
        cancelButton.removeEventListener("click", onCancel);
        confirmButton.removeEventListener("click", onConfirm);
        modal.removeEventListener("click", onBackdrop);
        input.removeEventListener("keydown", onInputKeyDown);
        document.removeEventListener("keydown", onKeyDown);
        previousFocus?.focus?.();
        resolve(result);
      };

      const submit = () => cleanup(input.value.trim() || defaultName);
      const onCancel = () => cleanup(null);
      const onConfirm = () => submit();
      const onBackdrop = (event) => {
        if (event.target === modal) {
          cleanup(null);
        }
      };
      const onInputKeyDown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup(null);
        }
      };

      input.value = defaultName;
      modal.hidden = false;
      document.body.classList.add("has-modal");
      cancelButton.addEventListener("click", onCancel);
      confirmButton.addEventListener("click", onConfirm);
      modal.addEventListener("click", onBackdrop);
      input.addEventListener("keydown", onInputKeyDown);
      document.addEventListener("keydown", onKeyDown);
      input.focus();
      input.select();
    });
  }

  confirmAbort() {
    return new Promise((resolve) => {
      const modal = this.elements.abortModal;
      const cancelButton = this.elements.abortCancelButton;
      const confirmButton = this.elements.abortConfirmButton;
      const previousFocus = document.activeElement;

      const cleanup = (result) => {
        modal.hidden = true;
        document.body.classList.remove("has-modal");
        cancelButton.removeEventListener("click", onCancel);
        confirmButton.removeEventListener("click", onConfirm);
        modal.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKeyDown);
        previousFocus?.focus?.();
        resolve(result);
      };

      const onCancel = () => cleanup(false);
      const onConfirm = () => cleanup(true);
      const onBackdrop = (event) => {
        if (event.target === modal) {
          cleanup(false);
        }
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup(false);
        }
      };

      modal.hidden = false;
      document.body.classList.add("has-modal");
      cancelButton.addEventListener("click", onCancel);
      confirmButton.addEventListener("click", onConfirm);
      modal.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKeyDown);
      cancelButton.focus();
    });
  }

  render(state) {
    const course = state.course;
    const targets = getCourseTargets(course);
    const nextTarget = targets[state.activeIndex];
    const visitedCount = state.visits.length;
    const totalTargets = targets.length;
    const progressPercent =
      totalTargets > 0 ? Math.min(100, (visitedCount / totalTargets) * 100) : 0;
    const isPlaying = state.status === GameStatus.playing;
    const isFinished = state.status === GameStatus.finished;
    const isEditing = state.editingCourse;
    const status = statusLabel(state);

    this.elements.courseDistanceBadge.textContent = course
      ? formatDistance(course.plannedDistanceMeters)
      : "Ei rataa";
    this.elements.timerText.textContent = formatDuration(state.elapsedMillis);
    this.elements.headerStatePill.textContent = isEditing ? "Radan muokkaus" : status;
    this.elements.gameStatusText.textContent = isEditing ? "Radan muokkaus" : status;
    this.elements.gpsStatusText.textContent = gpsLabel(state.latestPosition, state.start);
    this.elements.nextTargetText.textContent =
      state.status === GameStatus.finished
        ? finishLabel(state.finishReason)
        : nextTarget?.label || "-";
    this.elements.trackPointText.textContent = `${state.track.length} pistettä`;
    this.elements.visitedCountText.textContent = `${visitedCount}/${totalTargets}`;
    this.elements.finishText.textContent =
      isFinished ? formatDuration(state.elapsedMillis) : "-";
    this.elements.sidebarProgressBar.style.width = `${progressPercent}%`;

    document.body.classList.toggle("is-playing", isPlaying);
    document.body.classList.toggle("is-finished", isFinished);
    this.elements.startButton.textContent = "Aloita suunnistus";
    this.elements.startButton.disabled = !course || isEditing;
    this.elements.playHud.hidden = !isPlaying;
    this.elements.floatingAbortButton.hidden = !isPlaying;
    this.elements.mapInfo.hidden = isPlaying;
    this.elements.generateButton.disabled = isPlaying || isEditing;
    this.elements.editCourseButton.disabled = !course || isPlaying || isFinished;
    this.elements.editCourseButton.textContent = isEditing
      ? "Lopeta muokkaus"
      : "Muokkaa rataa";
    this.elements.editCourseButton.classList.toggle("is-active", isEditing);
    this.elements.courseEditHint.hidden = !isEditing;
    this.elements.mapRotationControls.classList.toggle("is-disabled", isEditing);
    this.elements.rotateMapLeftButton.disabled = isEditing;
    this.elements.resetMapRotationButton.disabled = isEditing;
    this.elements.rotateMapRightButton.disabled = isEditing;
    this.elements.saveBlankButton.disabled = !course || isEditing;
    this.elements.saveResultButton.disabled =
      !course || (state.track.length === 0 && state.visits.length === 0);

    this.renderStartState(state);
    this.renderMapInfo(state);
    this.renderPlayHud(state, nextTarget, visitedCount, totalTargets, progressPercent);
    this.renderResult(state, visitedCount, totalTargets);
    this.renderControls(course, state);
    this.renderSplits(state);
  }

  renderStartState(state) {
    const source = state.start?.source;
    this.elements.startPointText.textContent = source
      ? `Lähtö asetettu (${source})`
      : "Lähtöpistettä ei ole valittu";

    if (!state.course) {
      this.elements.startReadinessText.textContent = "Luo ensin rata";
      return;
    }

    if (state.editingCourse) {
      this.elements.startReadinessText.textContent = "Lopeta muokkaus ennen aloitusta";
      return;
    }

    if (!state.latestPosition) {
      this.elements.startReadinessText.textContent = "Paikanna itsesi ennen aloitusta";
      return;
    }

    const distance = distanceMeters(state.latestPosition, state.course.start);
    this.elements.startReadinessText.textContent =
      distance <= START_RADIUS_METERS
        ? "Olet lähtöpisteessä, valmiina lähtöön"
        : `${formatDistance(distance)} lähtöpisteeseen`;
  }

  renderMapInfo(state) {
    if (state.editingCourse) {
      this.elements.mapInfoTitle.textContent = "Muokkaa rataa";
      this.elements.mapInfoText.textContent =
        "Raahaa hiirellä tai valitse piste koskettamalla ja napauta sille uusi paikka.";
      return;
    }

    if (state.status === GameStatus.finished) {
      this.elements.mapInfoTitle.textContent =
        state.finishReason === "aborted" ? "Suunnistus keskeytetty" : "Suoritus valmis";
      this.elements.mapInfoText.textContent = `${formatDuration(state.elapsedMillis)} · ${formatDistance(
        routeDistanceMeters(state.track),
      )} kuljettu`;
      return;
    }

    if (state.course) {
      const controlCount = state.course.controls?.length || 0;
      this.elements.mapInfoTitle.textContent = `${formatDistance(
        state.course.plannedDistanceMeters,
      )} rata valmis`;
      this.elements.mapInfoText.textContent = `${controlCount} rastia ja maali · siirry lähtöpisteeseen`;
      return;
    }

    if (state.start) {
      this.elements.mapInfoTitle.textContent = "Lähtöpiste asetettu";
      this.elements.mapInfoText.textContent = "Valitse radan pituus ja rastien määrä.";
      return;
    }

    this.elements.mapInfoTitle.textContent = "Valitse lähtöpiste";
    this.elements.mapInfoText.textContent =
      "Paikanna itsesi tai käytä kartan keskikohtaa.";
  }

  renderPlayHud(state, nextTarget, visitedCount, totalTargets, progressPercent) {
    this.elements.hudTimerText.textContent = formatDuration(state.elapsedMillis);
    this.elements.hudNextTargetText.textContent = nextTarget?.label || "Maali";
    this.elements.hudProgressText.textContent = `${visitedCount}/${totalTargets} käyty`;
    this.elements.hudProgressBar.style.width = `${progressPercent}%`;
  }

  renderResult(state, visitedCount, totalTargets) {
    const isFinished = state.status === GameStatus.finished;
    this.elements.resultSummary.hidden = !isFinished;
    if (!isFinished) {
      return;
    }

    const aborted = state.finishReason === "aborted";
    this.elements.resultTitle.textContent = aborted
      ? "Suunnistus keskeytettiin"
      : "Maali löytyi";
    this.elements.resultTimeText.textContent = formatDuration(state.elapsedMillis);
    this.elements.resultDistanceText.textContent = formatDistance(
      routeDistanceMeters(state.track),
    );
    this.elements.resultControlsText.textContent = `${visitedCount}/${totalTargets}`;
    this.elements.resultLead.textContent = aborted
      ? "Reitti keskeytykseen saakka näkyy kartalla ja voidaan tallentaa."
      : "Hieno suoritus. Koko kuljettu reitti näkyy nyt kartalla.";
  }

  renderSavedItems(items, preferredId = this.elements.savedItemsSelect.value) {
    this.elements.savedItemsSelect.replaceChildren();

    if (items.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Ei tallennuksia";
      this.elements.savedItemsSelect.append(option);
      this.elements.savedCountText.textContent = "0 kpl";
      this.elements.loadSavedButton.disabled = true;
      return;
    }

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${savedTypeLabel(item.type)}: ${item.name} (${formatDateTime(item.savedAt)})`;
      this.elements.savedItemsSelect.append(option);
    });

    if (preferredId && items.some((item) => item.id === preferredId)) {
      this.elements.savedItemsSelect.value = preferredId;
    }

    this.elements.savedCountText.textContent = `${items.length} kpl`;
    this.elements.loadSavedButton.disabled = false;
  }

  renderControls(course, state) {
    const list = this.elements.controlsList;
    list.replaceChildren();

    if (!course) {
      const empty = document.createElement("li");
      empty.innerHTML =
        '<span class="control-badge">-</span><span class="control-name">Ei rataa</span><span class="control-meta">-</span>';
      list.append(empty);
      return;
    }

    getCourseTargets(course).forEach((target, index) => {
      const visit = state.visits.find((item) => item.id === target.id);
      const row = document.createElement("li");
      row.classList.toggle("visited", Boolean(visit));
      row.classList.toggle(
        "active",
        state.status === GameStatus.playing && index === state.activeIndex,
      );

      const badge = document.createElement("span");
      badge.className = "control-badge";
      badge.textContent = target.type === "finish" ? "M" : target.order;

      const name = document.createElement("span");
      name.className = "control-name";
      name.textContent = target.label;

      const meta = document.createElement("span");
      meta.className = "control-meta";
      meta.textContent = visit ? formatDuration(visit.cumulativeMillis) : "-";

      row.append(badge, name, meta);
      list.append(row);
    });
  }

  renderSplits(state) {
    const body = this.elements.splitsTableBody;
    body.replaceChildren();

    if (state.visits.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="3">Ei väliaikoja</td>';
      body.append(row);
      return;
    }

    state.visits.forEach((visit) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(visit.label)}</td>
        <td>${formatDuration(visit.splitMillis)}</td>
        <td>${formatDuration(visit.cumulativeMillis)}</td>
      `;
      body.append(row);
    });
  }

  notify(message) {
    clearTimeout(this.toastTimer);
    this.elements.toast.textContent = message;
    this.elements.toast.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      this.elements.toast.hidden = true;
    }, 5200);
  }
}

function statusLabel(state) {
  if (state.status === GameStatus.finished && state.finishReason === "aborted") {
    return "Keskeytetty";
  }

  const labels = {
    [GameStatus.planning]: "Suunnittelu",
    [GameStatus.ready]: "Rata valmis",
    [GameStatus.playing]: "Käynnissä",
    [GameStatus.finished]: "Maalissa",
  };

  return labels[state.status] || "Valmiina";
}

function finishLabel(reason) {
  if (reason === "aborted") {
    return "Keskeytetty";
  }

  return "Valmis";
}

function savedTypeLabel(type) {
  if (type === "result") {
    return "Reitti";
  }

  return "Rata";
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function gpsLabel(position, start) {
  const source = position?.source || start?.source;
  const accuracy = position?.accuracy || start?.accuracy;

  if (!source) {
    return "Ei sijaintia";
  }

  if (accuracy) {
    return `${source}, +/- ${Math.round(accuracy)} m`;
  }

  return source;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
