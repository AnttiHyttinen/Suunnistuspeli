import { formatDistance, formatDuration, getCourseTargets } from "./course.js";
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
      startButton: document.querySelector("#startButton"),
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
      controlsList: document.querySelector("#controlsList"),
      splitsTableBody: document.querySelector("#splitsTableBody"),
      finishText: document.querySelector("#finishText"),
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
    this.elements.startButton.addEventListener("click", () => actions.onStart?.());
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

  getSelectedSavedId() {
    return this.elements.savedItemsSelect.value;
  }

  askSaveName(defaultName) {
    return window.prompt("Anna tallennukselle nimi:", defaultName);
  }

  confirmAbort() {
    return window.confirm("Haluatko varmasti keskeyttää suunnistuksen?");
  }

  render(state) {
    const course = state.course;
    const targets = getCourseTargets(course);
    const nextTarget = targets[state.activeIndex];
    const visitedCount = state.visits.length;
    const totalTargets = targets.length;

    this.elements.courseDistanceBadge.textContent = course
      ? formatDistance(course.plannedDistanceMeters)
      : "Ei rataa";
    this.elements.timerText.textContent = formatDuration(state.elapsedMillis);
    this.elements.gameStatusText.textContent = statusLabel(state);
    this.elements.gpsStatusText.textContent = gpsLabel(state.latestPosition, state.start);
    this.elements.nextTargetText.textContent =
      state.status === GameStatus.finished
        ? finishLabel(state.finishReason)
        : nextTarget?.label || "-";
    this.elements.trackPointText.textContent = `${state.track.length} pistettä`;
    this.elements.visitedCountText.textContent = `${visitedCount}/${totalTargets}`;
    this.elements.finishText.textContent =
      state.status === GameStatus.finished ? formatDuration(state.elapsedMillis) : "-";

    const isPlaying = state.status === GameStatus.playing;
    this.elements.startButton.textContent = isPlaying ? "Lopeta peli" : "Aloita peli";
    this.elements.startButton.classList.toggle("danger", isPlaying);
    this.elements.startButton.disabled = !course;
    this.elements.generateButton.disabled = state.status === GameStatus.playing;
    this.elements.saveBlankButton.disabled = !course;
    this.elements.saveResultButton.disabled =
      !course || (state.track.length === 0 && state.visits.length === 0);

    this.renderControls(course, state);
    this.renderSplits(state);
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
