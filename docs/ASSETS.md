# Rejestr assetów i licencji

Zasady: tylko public domain / CC0 lub licencje wymagające jedynie atrybucji. Żadnej grafiki generowanej przez AI.
Każdy plik z `frontend/public/` (modele 3D, tekstury, ikony, dźwięki, czcionki) wpisujemy tutaj.

| Nazwa | Źródło (link) | Licencja | Autor | Gdzie użyte |
|-------|---------------|----------|-------|-------------|
| tree.glb (+ colormap.png) | https://kenney.nl/assets/mini-forest | CC0 | Kenney | `frontend/public/models/kenney-mini-forest/` — postać Drzewo |
| train-electric-city-a.glb (+ colormap.png) | https://kenney.nl/assets/train-kit | CC0 | Kenney | `frontend/public/models/kenney-train-kit/` — postać Pociąg |
| light-curved.glb (+ colormap.png) | https://kenney.nl/assets/city-kit-roads | CC0 | Kenney | `frontend/public/models/kenney-city-kit-roads/` — postać Latarnia |
| Rowerzysta, Stworek Kosz | własne, generowane w kodzie (three.js) | — (własność projektu) | zespół | `frontend/src/app/features/map/three/character-factory.ts` |

## Biblioteki i dane

| Nazwa | Licencja | Uwagi |
|-------|----------|-------|
| MapLibre GL JS | BSD-3-Clause | silnik mapy |
| OpenFreeMap / OpenMapTiles / OpenStreetMap | ODbL (atrybucja widoczna na mapie) | kafelki i styl `liberty` |
