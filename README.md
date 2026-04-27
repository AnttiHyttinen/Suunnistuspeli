# Suunnistuspeli

Staattinen web-sovellus suunnistuspelille. Sovellus käyttää Leaflet-karttaa ja on jaettu pieniin ES-moduuleihin:

- `src/course.js`: radan generointi, matkat ja ajankäsittely
- `src/game.js`: pelitila, rastien kuittaus, väliajat ja GPS-jäljen paljastus
- `src/geo.js`: selaimen paikannus
- `src/mapView.js`: Leaflet-kartta, rastit ja reittijälki
- `src/storage.js`: tyhjän radan ja suunnistetun radan JSON-tallennus
- `src/ui.js`: lomakkeet, tilannepaneeli ja väliaikataulukko

## Käynnistys

```powershell
python -m http.server 5173
```

Avaa sen jälkeen `http://localhost:5173`.

## Karttapohjat

Oletuskarttana on OpenTopoMap, koska se toimii ilman avainta ja näyttää korkeuskäyriä. Suomessa suunnistuskäyttöön paras vaihtoehto on Maanmittauslaitoksen Maastokartta, jonka voi valita sovelluksesta omalla API-avaimella.

- MML Karttakuvapalvelu: <https://www.maanmittauslaitos.fi/karttakuvapalvelu>
- MML API-avaimen ohje: <https://www.maanmittauslaitos.fi/node/13473>

## Tallennus

`Tallenna tyhjä rata` vie radan ilman kuljettua reittiä. `Tallenna reitti` vie saman radan, GPS-jäljen ja rastikohtaiset väliajat JSON-muodossa.
