import { generateCourse } from "./course.js";
import { createManualPosition, GeoTracker } from "./geo.js";
import { OrienteeringGame, GameStatus } from "./game.js";
import { MapView } from "./mapView.js";
import {
  getSavedItem,
  listSavedItems,
  saveBlankCourse,
  saveCompletedCourse,
  SavedItemType,
} from "./storage.js";
import { UI } from "./ui.js";

const MML_API_KEY_STORAGE = "suunnistuspeli.mmlApiKey";

window.addEventListener("DOMContentLoaded", () => {
  const ui = new UI();
  const game = new OrienteeringGame({
    onChange: (state) => renderAll(state),
    onNotify: (message) => ui.notify(message),
  });
  const mapView = new MapView("map", {
    onTargetClick: (targetId) => {
      game.handleTargetClick(targetId);
      if (game.getState().status === GameStatus.finished) {
        geoTracker.stop();
      }
    },
  });
  const geoTracker = new GeoTracker({
    onPosition: (position, options) => {
      game.updatePosition(position, options);
      const state = game.getState();
      if (state.status !== GameStatus.playing) {
        mapView.showUserLocation(position);
      }
    },
    onError: (message) => ui.notify(message),
  });

  const storedApiKey = localStorage.getItem(MML_API_KEY_STORAGE) || "";
  ui.setApiKey(storedApiKey);
  mapView.setBaseLayer(ui.getLayerSettings().layer, storedApiKey);

  ui.bind({
    onLayerChange: ({ layer, apiKey }) => {
      localStorage.setItem(MML_API_KEY_STORAGE, apiKey);
      if (layer === "mmlTopo" && !apiKey) {
        ui.setMapLayer("openTopo");
        mapView.setBaseLayer("openTopo");
        ui.notify("MML Maastokartta vaatii API-avaimen. OpenTopoMap pidetään käytössä.");
        return;
      }

      mapView.setBaseLayer(layer, apiKey);
    },
    onLocate: async () => {
      try {
        const position = await geoTracker.getCurrentPosition();
        game.setStart(position);
        mapView.setView(position, 16);
        mapView.showUserLocation(position);
        geoTracker.start();
        ui.notify("Lähtöpiste asetettiin nykyiseen sijaintiin.");
      } catch (error) {
        ui.notify(error.message || "Paikannus ei onnistunut.");
      }
    },
    onUseCenter: () => {
      const position = createManualPosition(mapView.getCenterPosition());
      game.setStart(position);
      mapView.showUserLocation(position);
      ui.notify("Lähtöpiste asetettiin kartan keskikohtaan.");
    },
    onGenerate: (settings) => {
      const state = game.getState();
      const start = state.start || geoTracker.getLastPosition();

      if (!start) {
        ui.notify("Paikanna lähtö tai käytä kartan keskikohtaa ensin.");
        return;
      }

      const course = generateCourse(start, settings);
      game.setCourse(course);
      mapView.drawCourse(course, game.getState());
      mapView.fitCourse(course);
      ui.notify("Rata luotu.");
    },
    onStart: async () => {
      if (game.getState().status === GameStatus.playing) {
        if (!ui.confirmAbort()) {
          return;
        }

        game.abort(geoTracker.getLastPosition());
        geoTracker.stop();
        return;
      }

      let position = geoTracker.getLastPosition();

      try {
        position = await geoTracker.getCurrentPosition();
      } catch (error) {
        ui.notify(error.message || "Paikannus ei onnistunut. Peli alkaa vain lähtöpisteessä.");
        return;
      }

      const started = game.start(position);
      if (!started) {
        return;
      }

      mapView.hideUserLocation();
      geoTracker.start();
    },
    onSaveBlank: () => {
      const course = game.getState().course;
      if (course) {
        const name = ui.askSaveName(defaultCourseName(course));
        if (name === null) {
          return;
        }

        const saved = saveBlankCourse(course, name);
        refreshSavedItems(saved.id);
        ui.notify(`Tyhjä rata tallennettiin selaimeen: ${saved.name}.`);
      }
    },
    onSaveResult: () => {
      const state = game.getState();
      if (state.course) {
        const name = ui.askSaveName(defaultResultName(state));
        if (name === null) {
          return;
        }

        const saved = saveCompletedCourse(state, name);
        refreshSavedItems(saved.id);
        ui.notify(`Kuljettu reitti tallennettiin selaimeen: ${saved.name}.`);
      }
    },
    onLoadSaved: (id) => {
      const item = getSavedItem(id);
      if (!item) {
        ui.notify("Valittua tallennusta ei löytynyt.");
        refreshSavedItems();
        return;
      }

      if (game.getState().status === GameStatus.playing && !ui.confirmAbort()) {
        return;
      }

      geoTracker.stop();

      if (item.type === SavedItemType.result) {
        game.loadResult(item.payload);
      } else {
        game.loadCourse(item.payload.course);
      }

      if (item.payload.course) {
        mapView.fitCourse(item.payload.course);
      }

      ui.notify(`Tallennus ladattu: ${item.name}.`);
    },
  });

  refreshSavedItems();

  window.setInterval(() => {
    ui.render(game.getState());
  }, 1000);

  window.addEventListener("resize", () => mapView.refreshSize());
  ui.render(game.getState());

  function renderAll(state) {
    if (state.status === GameStatus.playing || state.status === GameStatus.finished) {
      mapView.hideUserLocation();
    } else {
      mapView.showUserLocation(state.latestPosition || state.start);
    }

    mapView.drawCourse(state.course, state);
    mapView.drawVisibleTrack(state.visibleTrack);
    ui.render(state);
  }

  function refreshSavedItems(selectedId) {
    ui.renderSavedItems(listSavedItems(), selectedId);
  }
});

function defaultCourseName(course) {
  const distanceKm = ((course?.plannedDistanceMeters || 0) / 1000)
    .toFixed(1)
    .replace(".", ",");
  return `Rata ${distanceKm} km`;
}

function defaultResultName(state) {
  const date = new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const suffix = state.finishReason === "aborted" ? "keskeytetty" : "suoritettu";
  return `Reitti ${date} (${suffix})`;
}
