import { generateCourse } from "./course.js";
import { createManualPosition, GeoTracker } from "./geo.js";
import { OrienteeringGame, GameStatus } from "./game.js";
import { MapView } from "./mapView.js";
import { saveBlankCourse, saveCompletedCourse } from "./storage.js";
import { UI } from "./ui.js";

const MML_API_KEY_STORAGE = "suunnistuspeli.mmlApiKey";

window.addEventListener("DOMContentLoaded", () => {
  const ui = new UI();
  const game = new OrienteeringGame({
    onChange: (state) => renderAll(state),
    onNotify: (message) => ui.notify(message),
  });
  const mapView = new MapView("map", {
    onTargetClick: (targetId) => game.handleTargetClick(targetId),
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
    onStart: () => {
      const started = game.start(geoTracker.getLastPosition() || game.getState().start);
      if (!started) {
        return;
      }

      mapView.hideUserLocation();
      geoTracker.start();
    },
    onSaveBlank: () => {
      const course = game.getState().course;
      if (course) {
        saveBlankCourse(course);
        ui.notify("Tyhjä rata tallennettiin JSON-tiedostoksi.");
      }
    },
    onSaveResult: () => {
      const state = game.getState();
      if (state.course) {
        saveCompletedCourse(state);
        ui.notify("Suunnistettu rata tallennettiin JSON-tiedostoksi.");
      }
    },
  });

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
});
