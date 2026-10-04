-- WYGENEROWANY PLIK: nie edytować ręcznie. Źródło: frontend/src/app/core/scenario.catalog.ts
-- Odtworzenie: (cd frontend && npm run db:seed-scenarios)
-- Wymaga wcześniej: schema.sql i seed_reference.sql.
BEGIN;

-- Dziura lub uszkodzony chodnik
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-pothole', 'resident', 'problem', 'report', 'Dziura lub uszkodzony chodnik', 'Dziura, wyrwa, zapadnięta kostka.', '🕳️', (SELECT id FROM collection_character WHERE code = 'floor_hole'), 'Dziura w chodniku', 0);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-pothole'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-pothole'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-pothole') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Dziura w chodniku', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-pothole'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-pothole') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-pothole'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-pothole') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Brak kosza na śmieci
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-bin', 'resident', 'problem', 'report', 'Brak kosza na śmieci', 'Brakuje kosza albo jest przepełniony.', '🗑️', (SELECT id FROM collection_character WHERE code = 'trash_can'), 'Brakuje kosza na śmieci', 1);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-bin'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-bin'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-bin') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Brakuje kosza na śmieci', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-bin'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-bin') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-bin'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-bin') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Zepsuta latarnia
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-lamp', 'resident', 'problem', 'report', 'Zepsuta latarnia', 'Ciemno, latarnia nie świeci.', '💡', (SELECT id FROM collection_character WHERE code = 'billboard'), 'Zepsuta latarnia', 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-lamp'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-lamp'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-lamp') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Zepsuta latarnia', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-lamp'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-lamp') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-lamp'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-lamp') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Zaniedbana zieleń
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-green', 'resident', 'problem', 'report', 'Zaniedbana zieleń', 'Zarośnięty skwer, chore drzewo, brak trawnika.', '🌳', (SELECT id FROM collection_character WHERE code = 'tree'), 'Zaniedbana zieleń', 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-green'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-green'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-green') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Zaniedbana zieleń', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-green'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-green') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-green'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-green') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Problem z komunikacją
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-transport', 'resident', 'problem', 'report', 'Problem z komunikacją', 'Przystanek, rozkład, korek, niebezpieczne przejście.', '🚆', (SELECT id FROM collection_character WHERE code = 'car'), 'Problem z komunikacją', 4);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-transport'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-transport'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-transport') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Problem z komunikacją', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-transport'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-transport') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-transport'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-transport') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Problem dla rowerzystów
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-bike', 'resident', 'problem', 'report', 'Problem dla rowerzystów', 'Brak ścieżki, zepsuty stojak, niebezpieczny odcinek.', '🚴', (SELECT id FROM collection_character WHERE code = 'bicycle'), 'Problem dla rowerzystów', 5);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-bike'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-bike') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Problem dla rowerzystów', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-bike') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-bike') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Hałas
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-noise', 'resident', 'problem', 'report', 'Hałas', 'Głośne wydarzenia, nocne imprezy, ruch uliczny.', '🔊', (SELECT id FROM collection_character WHERE code = 'sports_car'), 'Uciążliwy hałas', 6);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-noise'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-noise'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-noise') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Uciążliwy hałas', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-noise'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-noise') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-noise'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-noise') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Parkowanie
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-parking', 'resident', 'problem', 'report', 'Parkowanie', 'Brak miejsc postojowych, auta na chodniku lub trawniku.', '🅿️', (SELECT id FROM collection_character WHERE code = 'car'), 'Problem z parkowaniem', 7);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-parking'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-parking'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-parking') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Problem z parkowaniem', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-parking'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-parking') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-parking'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-parking') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Smród i smog
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-air', 'resident', 'problem', 'report', 'Smród i smog', 'Zapach, dym z kominów, zanieczyszczone powietrze.', '🌫️', (SELECT id FROM collection_character WHERE code = 'air_conditioner'), 'Smród lub smog', 8);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-air'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-air'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-air') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Smród lub smog', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-air'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-air') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-air'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-air') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Upał i brak cienia
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-heat', 'resident', 'problem', 'report', 'Upał i brak cienia', 'Za mało zieleni i cienia, nagrzany beton.', '☀️', (SELECT id FROM collection_character WHERE code = 'potted_tree'), 'Brak cienia i zieleni', 9);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-heat'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-heat'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-heat') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Brak cienia i zieleni', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-heat'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-heat') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-heat'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-heat') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Inny problem
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('res-other', 'resident', 'problem', 'report', 'Inny problem', 'Coś, co psuje to miejsce, a nie pasuje do pozostałych kategorii.', '📌', (SELECT id FROM collection_character WHERE code = 'cone'), 'Inny problem w mieście', 10);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'res-other'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-other') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Inny problem w mieście', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-other') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'res-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'res-other') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);

-- Przystanek autobusowy
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('idea-bus-stop', 'resident', 'initiative', 'idea', 'Przystanek autobusowy', 'Tu przydałby się nowy przystanek.', '🚏', (SELECT id FROM collection_character WHERE code = 'small_car'), 'Nowy przystanek', 11);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Nowy przystanek', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND sort_order = 0), 'whoBenefits', 'Kto by na tym skorzystał', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'kids', 'Dzieci', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'teens', 'Młodzież', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'seniors', 'Seniorzy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'parents', 'Rodzice z wózkami', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'bikers', 'Rowerzyści', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'disabled', 'Osoby z niepełnosprawnościami', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bus-stop') AND field_key = 'whoBenefits'), 'all', 'Wszyscy', 6);

-- Sklep lub usługa na osiedlu
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('idea-shop', 'resident', 'initiative', 'idea', 'Sklep lub usługa na osiedlu', 'Warzywniak, piekarnia, apteka, punkt usługowy.', '🥕', (SELECT id FROM collection_character WHERE code = 'van'), 'Sklep warzywny na osiedlu', 12);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'idea-shop'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-shop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Sklep warzywny na osiedlu', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-shop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-shop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND sort_order = 0), 'shopKind', 'Czego brakuje', 'choice', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-shop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND sort_order = 0), 'whoBenefits', 'Kto by na tym skorzystał', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-shop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'shopKind'), 'veg', 'Warzywniak', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'shopKind'), 'bakery', 'Piekarnia', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'shopKind'), 'pharmacy', 'Apteka', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'shopKind'), 'grocery', 'Sklep spożywczy', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'shopKind'), 'service', 'Punkt usługowy', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'shopKind'), 'other', 'Coś innego', 5);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'kids', 'Dzieci', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'teens', 'Młodzież', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'seniors', 'Seniorzy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'parents', 'Rodzice z wózkami', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'bikers', 'Rowerzyści', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'disabled', 'Osoby z niepełnosprawnościami', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-shop') AND field_key = 'whoBenefits'), 'all', 'Wszyscy', 6);

-- Plac zabaw lub boisko
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('idea-playground', 'resident', 'initiative', 'idea', 'Plac zabaw lub boisko', 'Miejsce do zabawy i sportu.', '🛝', (SELECT id FROM collection_character WHERE code = 'bench'), 'Nowy plac zabaw', 13);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'idea-playground'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-playground'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Nowy plac zabaw', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-playground'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-playground'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND sort_order = 0), 'whoBenefits', 'Kto by na tym skorzystał', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-playground'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'kids', 'Dzieci', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'teens', 'Młodzież', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'seniors', 'Seniorzy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'parents', 'Rodzice z wózkami', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'bikers', 'Rowerzyści', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'disabled', 'Osoby z niepełnosprawnościami', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-playground') AND field_key = 'whoBenefits'), 'all', 'Wszyscy', 6);

-- Zieleń, drzewa, skwer
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('idea-greenery', 'resident', 'initiative', 'idea', 'Zieleń, drzewa, skwer', 'Tu mogłoby być zielono.', '🌿', (SELECT id FROM collection_character WHERE code = 'potted_tree'), 'Więcej zieleni', 14);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Więcej zieleni', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND sort_order = 0), 'whoBenefits', 'Kto by na tym skorzystał', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'kids', 'Dzieci', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'teens', 'Młodzież', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'seniors', 'Seniorzy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'parents', 'Rodzice z wózkami', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'bikers', 'Rowerzyści', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'disabled', 'Osoby z niepełnosprawnościami', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-greenery') AND field_key = 'whoBenefits'), 'all', 'Wszyscy', 6);

-- Rowery: stojaki, ścieżka
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('idea-bike', 'resident', 'initiative', 'idea', 'Rowery: stojaki, ścieżka', 'Infrastruktura dla rowerzystów.', '🚲', (SELECT id FROM collection_character WHERE code = 'bicycle'), 'Stojaki lub ścieżka rowerowa', 15);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bike'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Stojaki lub ścieżka rowerowa', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND sort_order = 0), 'whoBenefits', 'Kto by na tym skorzystał', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-bike'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'kids', 'Dzieci', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'teens', 'Młodzież', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'seniors', 'Seniorzy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'parents', 'Rodzice z wózkami', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'bikers', 'Rowerzyści', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'disabled', 'Osoby z niepełnosprawnościami', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-bike') AND field_key = 'whoBenefits'), 'all', 'Wszyscy', 6);

-- Inny pomysł
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('idea-other', 'resident', 'initiative', 'idea', 'Inny pomysł', 'Coś, czego tu brakuje.', '💭', (SELECT id FROM collection_character WHERE code = 'cone'), 'Mój pomysł dla miasta', 16);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'idea-other'), 'Zgłoszenie', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND sort_order = 0), 'title', 'Tytuł', 'text', true, NULL, 'Mój pomysł dla miasta', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND sort_order = 0), 'description', 'Opis (opcjonalnie)', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND sort_order = 0), 'whoBenefits', 'Kto by na tym skorzystał', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'idea-other'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'kids', 'Dzieci', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'teens', 'Młodzież', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'seniors', 'Seniorzy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'parents', 'Rodzice z wózkami', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'bikers', 'Rowerzyści', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'disabled', 'Osoby z niepełnosprawnościami', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'idea-other') AND field_key = 'whoBenefits'), 'all', 'Wszyscy', 6);

-- Jedzenie i kawa
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('place-food', 'resident', 'place', 'place', 'Jedzenie i kawa', 'Kawiarnia, street food, bar, cukiernia.', '☕', (SELECT id FROM collection_character WHERE code = 'bench'), '', 17);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), 'O miejscu', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 0), 'title', 'Nazwa miejsca', 'text', true, NULL, 'np. Kawiarnia pod żyrandolem', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 0), 'description', 'Co tu jest fajnego?', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), 'Twoja opinia', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'rating', 'Ocena', 'rating', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'cost', 'Ile kosztuje skorzystanie', 'choice', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'vibes', 'Jaki jest klimat', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'bestTime', 'Kiedy najlepiej wpaść', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'accessible', 'Dostępne dla wózków i osób z niepełnosprawnościami', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'offer', 'Co tu zjesz i wypijesz', 'choice', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'vegan', 'Są opcje wegetariańskie lub wegańskie', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'wifi', 'Jest Wi-Fi', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 7),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-food'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND sort_order = 1), 'tips', 'Wskazówka dla innych', 'textarea', false, NULL, 'np. wejdź od podwórka, najlepsze miejsca przy oknie', NULL, NULL, NULL, NULL, NULL, 8);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'cost'), 'free', 'Za darmo', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'cost'), 'cheap', 'Tanio (do 20 zł)', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'cost'), 'medium', 'Średnio (20–60 zł)', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'cost'), 'expensive', 'Drogo (60 zł i więcej)', 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'calm', 'Spokojnie', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'loud', 'Głośno', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'friends', 'Z ekipą', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'date', 'Na randkę', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'solo', 'Samemu', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'kids', 'Z dzieckiem', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'photo', 'Instagramowe', 6),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'vibes'), 'dogs', 'Z psem', 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'bestTime'), 'morning', 'Rano', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'bestTime'), 'afternoon', 'Popołudnie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'bestTime'), 'evening', 'Wieczór', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'bestTime'), 'night', 'Noc', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'bestTime'), 'weekend', 'Weekend', 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'offer'), 'coffee', 'Kawa i desery', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'offer'), 'streetfood', 'Street food', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'offer'), 'fast', 'Fast food', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'offer'), 'restaurant', 'Restauracja', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'offer'), 'bar', 'Bar', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-food') AND field_key = 'offer'), 'bakery', 'Piekarnia', 5);

-- Zieleń i chillout
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('place-chill', 'resident', 'place', 'place', 'Zieleń i chillout', 'Park, skwer, widok, miejsce nad wodą.', '🌇', (SELECT id FROM collection_character WHERE code = 'flower_pot'), '', 18);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), 'O miejscu', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 0), 'title', 'Nazwa miejsca', 'text', true, NULL, 'np. Skwer z hamakami', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 0), 'description', 'Co tu jest fajnego?', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), 'Twoja opinia', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'rating', 'Ocena', 'rating', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'cost', 'Ile kosztuje skorzystanie', 'choice', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'vibes', 'Jaki jest klimat', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'bestTime', 'Kiedy najlepiej wpaść', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'accessible', 'Dostępne dla wózków i osób z niepełnosprawnościami', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'spotType', 'Rodzaj miejsca', 'choice', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'shade', 'Jest cień', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'dogsOk', 'Można z psem', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 7),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-chill'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND sort_order = 1), 'tips', 'Wskazówka dla innych', 'textarea', false, NULL, 'np. wejdź od podwórka, najlepsze miejsca przy oknie', NULL, NULL, NULL, NULL, NULL, 8);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'cost'), 'free', 'Za darmo', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'cost'), 'cheap', 'Tanio (do 20 zł)', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'cost'), 'medium', 'Średnio (20–60 zł)', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'cost'), 'expensive', 'Drogo (60 zł i więcej)', 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'calm', 'Spokojnie', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'loud', 'Głośno', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'friends', 'Z ekipą', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'date', 'Na randkę', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'solo', 'Samemu', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'kids', 'Z dzieckiem', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'photo', 'Instagramowe', 6),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'vibes'), 'dogs', 'Z psem', 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'bestTime'), 'morning', 'Rano', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'bestTime'), 'afternoon', 'Popołudnie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'bestTime'), 'evening', 'Wieczór', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'bestTime'), 'night', 'Noc', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'bestTime'), 'weekend', 'Weekend', 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'spotType'), 'park', 'Park', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'spotType'), 'square', 'Skwer', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'spotType'), 'view', 'Punkt widokowy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'spotType'), 'water', 'Nad wodą', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-chill') AND field_key = 'spotType'), 'bench', 'Ławka z klimatem', 4);

-- Rozrywka i sport
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('place-fun', 'resident', 'place', 'place', 'Rozrywka i sport', 'Skatepark, boisko, arcade, tor rowerowy.', '🛹', (SELECT id FROM collection_character WHERE code = 'sports_car'), '', 19);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), 'O miejscu', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 0), 'title', 'Nazwa miejsca', 'text', true, NULL, 'np. Skatepark pod mostem', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 0), 'description', 'Co tu jest fajnego?', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), 'Twoja opinia', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'rating', 'Ocena', 'rating', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'cost', 'Ile kosztuje skorzystanie', 'choice', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'vibes', 'Jaki jest klimat', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'bestTime', 'Kiedy najlepiej wpaść', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'accessible', 'Dostępne dla wózków i osób z niepełnosprawnościami', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'activity', 'Co tu robisz', 'choice', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'ownGear', 'Trzeba mieć własny sprzęt', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-fun'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND sort_order = 1), 'tips', 'Wskazówka dla innych', 'textarea', false, NULL, 'np. wejdź od podwórka, najlepsze miejsca przy oknie', NULL, NULL, NULL, NULL, NULL, 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'cost'), 'free', 'Za darmo', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'cost'), 'cheap', 'Tanio (do 20 zł)', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'cost'), 'medium', 'Średnio (20–60 zł)', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'cost'), 'expensive', 'Drogo (60 zł i więcej)', 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'calm', 'Spokojnie', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'loud', 'Głośno', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'friends', 'Z ekipą', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'date', 'Na randkę', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'solo', 'Samemu', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'kids', 'Z dzieckiem', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'photo', 'Instagramowe', 6),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'vibes'), 'dogs', 'Z psem', 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'bestTime'), 'morning', 'Rano', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'bestTime'), 'afternoon', 'Popołudnie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'bestTime'), 'evening', 'Wieczór', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'bestTime'), 'night', 'Noc', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'bestTime'), 'weekend', 'Weekend', 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'activity'), 'skate', 'Skatepark', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'activity'), 'court', 'Boisko', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'activity'), 'gym', 'Siłownia plenerowa', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'activity'), 'arcade', 'Salon gier', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'activity'), 'trampoline', 'Trampoliny', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-fun') AND field_key = 'activity'), 'other', 'Coś innego', 5);

-- Kultura i hobby
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('place-culture', 'resident', 'place', 'place', 'Kultura i hobby', 'Mural, galeria, biblioteka, księgarnia, koncerty.', '🎨', (SELECT id FROM collection_character WHERE code = 'billboard'), '', 20);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), 'O miejscu', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 0), 'title', 'Nazwa miejsca', 'text', true, NULL, 'np. Mural na starej kamienicy', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 0), 'description', 'Co tu jest fajnego?', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 0), 'photos', 'Zdjęcie', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), 'Twoja opinia', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'rating', 'Ocena', 'rating', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'cost', 'Ile kosztuje skorzystanie', 'choice', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'vibes', 'Jaki jest klimat', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'bestTime', 'Kiedy najlepiej wpaść', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'accessible', 'Dostępne dla wózków i osób z niepełnosprawnościami', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'cultureKind', 'Rodzaj miejsca', 'choice', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'ticket', 'Potrzebny bilet', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6),
  ((SELECT id FROM scenarios_scenario WHERE code = 'place-culture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND sort_order = 1), 'tips', 'Wskazówka dla innych', 'textarea', false, NULL, 'np. wejdź od podwórka, najlepsze miejsca przy oknie', NULL, NULL, NULL, NULL, NULL, 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cost'), 'free', 'Za darmo', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cost'), 'cheap', 'Tanio (do 20 zł)', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cost'), 'medium', 'Średnio (20–60 zł)', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cost'), 'expensive', 'Drogo (60 zł i więcej)', 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'calm', 'Spokojnie', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'loud', 'Głośno', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'friends', 'Z ekipą', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'date', 'Na randkę', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'solo', 'Samemu', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'kids', 'Z dzieckiem', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'photo', 'Instagramowe', 6),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'vibes'), 'dogs', 'Z psem', 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'bestTime'), 'morning', 'Rano', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'bestTime'), 'afternoon', 'Popołudnie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'bestTime'), 'evening', 'Wieczór', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'bestTime'), 'night', 'Noc', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'bestTime'), 'weekend', 'Weekend', 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cultureKind'), 'mural', 'Mural / street art', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cultureKind'), 'gallery', 'Galeria', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cultureKind'), 'library', 'Biblioteka', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cultureKind'), 'bookshop', 'Księgarnia', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cultureKind'), 'museum', 'Muzeum', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'place-culture') AND field_key = 'cultureKind'), 'concerts', 'Koncerty', 5);

-- Nowy przystanek autobusowy
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('org-bus-stop', 'org', NULL, 'ngo', 'Nowy przystanek autobusowy', 'Propozycja nowego przystanku wraz ze zmianami w liniach.', '🚏', (SELECT id FROM collection_character WHERE code = 'small_car'), 'Nowy przystanek autobusowy', 21);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), 'Podstawowe informacje', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 0), 'character', 'Postać na mapie', 'character', false, 'Jak ta inicjatywa wyświetli się mieszkańcom', NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 0), 'title', 'Tytuł inicjatywy', 'text', true, NULL, 'Nowy przystanek autobusowy', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 0), 'description', 'Krótki opis dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 0), 'photos', 'Zdjęcia, wizualizacje', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), 'Linie komunikacyjne', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 1), 'linesNew', 'Linie uruchomione od zera', 'tags', false, 'Numery oddzielone przecinkami, np. 192, 502', NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 1), 'linesRerouted', 'Linie przekierowane przez ten przystanek', 'tags', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 1), 'linesRemoved', 'Linie wycofane z tego miejsca', 'tags', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 1), 'direction', 'Kierunek / kierunki', 'text', false, NULL, 'np. w stronę Dworca Głównego', NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 1), 'onDemand', 'Przystanek na żądanie', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 1), 'frequency', 'Planowana częstotliwość kursów', 'select', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'frequency'), '10', 'Co 10 min lub częściej', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'frequency'), '20', 'Co 20 min', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'frequency'), '30', 'Co 30 min', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'frequency'), '60', 'Co godzinę lub rzadziej', 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), 'Wyposażenie przystanku', 2);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'shelter', 'Wiata przystankowa', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'shelterSize', 'Rozmiar wiaty', 'select', true, NULL, NULL, NULL, NULL, NULL, 'shelter', 'true'::jsonb, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'shelterLength', 'Długość wiaty', 'number', false, NULL, NULL, 'm', 1, 20, 'shelter', 'true'::jsonb, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'bench', 'Ławka', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'infoBoard', 'Tablica z rozkładem jazdy', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'realTimeDisplay', 'Tablica czasu rzeczywistego', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'lighting', 'Oświetlenie', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'raisedKerb', 'Podwyższony krawężnik (dostępność)', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 7),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'tactilePaving', 'Pas prowadzący dla osób niewidomych', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 8),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 2), 'bikeRack', 'Stojak rowerowy w pobliżu', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 9);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'shelterSize'), 'small', 'Mała (do 2 m)', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'shelterSize'), 'medium', 'Średnia (3–4 m)', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND field_key = 'shelterSize'), 'large', 'Duża (5 m i więcej)', 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), 'Plan realizacji', 3);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 3), 'plannedDate', 'Planowany termin uruchomienia', 'date', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 3), 'estimatedCost', 'Szacowany koszt', 'number', false, NULL, NULL, 'zł', 0, NULL, NULL, NULL, 1);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), 'Kontakt i odpowiedzialność', 4);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 4), 'contactPerson', 'Osoba kontaktowa', 'text', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 4), 'contactEmail', 'E-mail kontaktowy', 'text', true, NULL, 'osoba@organizacja.pl', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 4), 'contactPhone', 'Telefon', 'text', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-bus-stop') AND sort_order = 4), 'rationale', 'Uzasadnienie i korzyści dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3);

-- Nowe drzewo w danym miejscu
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('org-tree', 'org', NULL, 'ngo', 'Nowe drzewo w danym miejscu', 'Propozycja nasadzenia drzewa lub grupy drzew.', '🌳', (SELECT id FROM collection_character WHERE code = 'tree'), 'Nowe nasadzenie drzew', 22);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), 'Podstawowe informacje', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 0), 'character', 'Postać na mapie', 'character', false, 'Jak ta inicjatywa wyświetli się mieszkańcom', NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 0), 'title', 'Tytuł inicjatywy', 'text', true, NULL, 'Nowe nasadzenie drzew', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 0), 'description', 'Krótki opis dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 0), 'photos', 'Zdjęcia, wizualizacje', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), 'Nasadzenie', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 1), 'plantingType', 'Rodzaj nasadzenia', 'select', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 1), 'species', 'Gatunek', 'select', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 1), 'speciesOther', 'Jaki gatunek?', 'text', true, NULL, NULL, NULL, NULL, NULL, 'species', '"other"'::jsonb, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 1), 'count', 'Liczba sztuk', 'number', true, NULL, NULL, NULL, 1, 500, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 1), 'seedlingHeight', 'Wysokość sadzonki', 'select', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'plantingType'), 'new', 'Nowe nasadzenie', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'plantingType'), 'replace', 'Odtworzenie po wycince', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'plantingType'), 'grove', 'Kępa / mini-las', 2);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'species'), 'linden', 'Lipa drobnolistna', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'species'), 'maple', 'Klon', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'species'), 'oak', 'Dąb szypułkowy', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'species'), 'hornbeam', 'Grab', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'species'), 'rowan', 'Jarząb', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'species'), 'other', 'Inny', 5);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'seedlingHeight'), 's', 'Do 1,5 m', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'seedlingHeight'), 'm', '1,5–2,5 m', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'seedlingHeight'), 'l', 'Powyżej 2,5 m', 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), 'Zgody i utrzymanie', 2);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 2), 'landConsent', 'Mamy zgodę zarządcy terenu', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 2), 'landOwner', 'Zarządca terenu', 'text', true, NULL, NULL, NULL, NULL, NULL, 'landConsent', 'true'::jsonb, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 2), 'maintenanceBy', 'Kto zajmie się pielęgnacją', 'select', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 2), 'wateringPlan', 'Plan podlewania', 'textarea', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 2), 'plannedDate', 'Planowany termin nasadzenia', 'date', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'maintenanceBy'), 'org', 'Nasza organizacja', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'maintenanceBy'), 'city', 'Zarząd Zieleni Miejskiej', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND field_key = 'maintenanceBy'), 'residents', 'Mieszkańcy / wolontariusze', 2);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), 'Kontakt i odpowiedzialność', 3);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 3), 'contactPerson', 'Osoba kontaktowa', 'text', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 3), 'contactEmail', 'E-mail kontaktowy', 'text', true, NULL, 'osoba@organizacja.pl', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 3), 'contactPhone', 'Telefon', 'text', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-tree'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-tree') AND sort_order = 3), 'rationale', 'Uzasadnienie i korzyści dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3);

-- Uszkodzona mała architektura
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('org-small-architecture', 'org', NULL, 'ngo', 'Uszkodzona mała architektura', 'Zgłoszenie uszkodzonej ławki, kosza, placu zabaw, wiaty itp.', '🪑', (SELECT id FROM collection_character WHERE code = 'bench'), 'Uszkodzona mała architektura', 23);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), 'Podstawowe informacje', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 0), 'character', 'Postać na mapie', 'character', false, 'Jak ta inicjatywa wyświetli się mieszkańcom', NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 0), 'title', 'Tytuł inicjatywy', 'text', true, NULL, 'Uszkodzona mała architektura', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 0), 'description', 'Krótki opis dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 0), 'photos', 'Zdjęcia, wizualizacje', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), 'Uszkodzony obiekt', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'objectType', 'Rodzaj obiektu', 'select', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'damageLevel', 'Stopień uszkodzenia', 'select', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'cause', 'Prawdopodobna przyczyna', 'select', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'safetyRisk', 'Obiekt stwarza zagrożenie dla bezpieczeństwa', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'safetyDescription', 'Opisz zagrożenie', 'textarea', true, NULL, NULL, NULL, NULL, NULL, 'safetyRisk', 'true'::jsonb, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'urgency', 'Pilność naprawy', 'select', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'manager', 'Zarządca obiektu (jeśli znany)', 'text', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 1), 'estimatedCost', 'Szacowany koszt naprawy', 'number', false, NULL, NULL, 'zł', 0, NULL, NULL, NULL, 7);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'bench', 'Ławka', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'bin', 'Kosz na śmieci', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'playground', 'Plac zabaw', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'gym', 'Siłownia plenerowa', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'fountain', 'Fontanna / poidełko', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'shelter', 'Wiata', 5),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'bollard', 'Słupek / bariera', 6),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'board', 'Tablica informacyjna', 7),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'objectType'), 'other', 'Inny', 8);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'damageLevel'), 'minor', 'Drobne', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'damageLevel'), 'medium', 'Średnie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'damageLevel'), 'serious', 'Poważne', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'damageLevel'), 'destroyed', 'Całkowite zniszczenie', 3);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'cause'), 'vandalism', 'Wandalizm', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'cause'), 'wear', 'Zużycie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'cause'), 'weather', 'Pogoda', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'cause'), 'accident', 'Wypadek', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'cause'), 'unknown', 'Nieznana', 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'urgency'), 'low', 'Niska', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'urgency'), 'normal', 'Zwykła', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'urgency'), 'high', 'Wysoka', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND field_key = 'urgency'), 'immediate', 'Natychmiastowa', 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), 'Kontakt i odpowiedzialność', 2);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 2), 'contactPerson', 'Osoba kontaktowa', 'text', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 2), 'contactEmail', 'E-mail kontaktowy', 'text', true, NULL, 'osoba@organizacja.pl', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 2), 'contactPhone', 'Telefon', 'text', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-small-architecture') AND sort_order = 2), 'rationale', 'Uzasadnienie i korzyści dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3);

-- Szkoda na powierzchni
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('org-surface-damage', 'org', NULL, 'ngo', 'Szkoda na powierzchni', 'Dziury, zapadnięcia i uszkodzenia nawierzchni.', '🚧', (SELECT id FROM collection_character WHERE code = 'cone'), 'Uszkodzenie nawierzchni', 24);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), 'Podstawowe informacje', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 0), 'character', 'Postać na mapie', 'character', false, 'Jak ta inicjatywa wyświetli się mieszkańcom', NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 0), 'title', 'Tytuł inicjatywy', 'text', true, NULL, 'Uszkodzenie nawierzchni', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 0), 'description', 'Krótki opis dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 0), 'photos', 'Zdjęcia, wizualizacje', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), 'Charakter szkody', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 1), 'surfaceType', 'Rodzaj nawierzchni', 'select', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 1), 'damageType', 'Rodzaj szkody', 'select', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 1), 'areaM2', 'Powierzchnia uszkodzenia', 'number', false, NULL, NULL, 'm²', 0, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 1), 'depthCm', 'Głębokość', 'number', false, NULL, NULL, 'cm', 0, NULL, NULL, NULL, 3),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 1), 'blocksPassage', 'Szkoda blokuje przejście lub przejazd', 'boolean', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 1), 'affected', 'Kogo to dotyczy', 'multiselect', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'surfaceType'), 'asphalt', 'Asfalt', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'surfaceType'), 'paving', 'Kostka brukowa', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'surfaceType'), 'slabs', 'Płyty chodnikowe', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'surfaceType'), 'concrete', 'Beton', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'surfaceType'), 'ground', 'Grunt / trawnik', 4);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'damageType'), 'pothole', 'Dziura', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'damageType'), 'subsidence', 'Zapadnięcie', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'damageType'), 'crack', 'Pęknięcie', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'damageType'), 'rut', 'Koleiny', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'damageType'), 'kerb', 'Uszkodzony krawężnik', 4),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'damageType'), 'washout', 'Podmycie', 5);
INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'affected'), 'pedestrians', 'Piesi', 0),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'affected'), 'wheelchairs', 'Wózki i osoby z niepełnosprawnościami', 1),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'affected'), 'visually', 'Osoby niewidome', 2),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'affected'), 'bikes', 'Rowerzyści', 3),
  ((SELECT id FROM scenarios_field WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND field_key = 'affected'), 'cars', 'Kierowcy', 4);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), 'Kontakt i odpowiedzialność', 2);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 2), 'contactPerson', 'Osoba kontaktowa', 'text', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 2), 'contactEmail', 'E-mail kontaktowy', 'text', true, NULL, 'osoba@organizacja.pl', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 2), 'contactPhone', 'Telefon', 'text', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-surface-damage') AND sort_order = 2), 'rationale', 'Uzasadnienie i korzyści dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3);

-- Konsultacje społeczne
INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES
  ('org-consultation', 'org', NULL, 'consultation', 'Konsultacje społeczne', 'Pytamy mieszkańców o zdanie w sprawie planowanej zmiany. Ankieta z pytaniami dodawana jest do inicjatywy.', '🗳️', (SELECT id FROM collection_character WHERE code = 'bicycle'), 'Konsultacje społeczne', 25);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), 'Podstawowe informacje', 0);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 0), 'character', 'Postać na mapie', 'character', false, 'Jak ta inicjatywa wyświetli się mieszkańcom', NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 0), 'title', 'Tytuł inicjatywy', 'text', true, NULL, 'Konsultacje społeczne', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 0), 'description', 'Krótki opis dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 0), 'photos', 'Zdjęcia, wizualizacje', 'photos', false, 'Do 3 zdjęć', NULL, NULL, NULL, NULL, NULL, NULL, 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), 'Przebieg konsultacji', 1);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 1), 'topic', 'Czego dotyczą konsultacje', 'text', true, NULL, 'np. przyszłość terenów poprzemysłowych', NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 1), 'decisionBy', 'Kto podejmie decyzję', 'text', false, NULL, 'np. Rada Miasta Krakowa', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 1), 'consultationEnd', 'Konsultacje trwają do', 'date', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 1), 'estimatedCost', 'Szacowany koszt przedsięwzięcia', 'number', false, NULL, NULL, 'zł', 0, NULL, NULL, NULL, 3);
INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), 'Kontakt i odpowiedzialność', 2);
INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 2), 'contactPerson', 'Osoba kontaktowa', 'text', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 2), 'contactEmail', 'E-mail kontaktowy', 'text', true, NULL, 'osoba@organizacja.pl', NULL, NULL, NULL, NULL, NULL, 1),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 2), 'contactPhone', 'Telefon', 'text', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2),
  ((SELECT id FROM scenarios_scenario WHERE code = 'org-consultation'), (SELECT id FROM scenarios_section WHERE scenario_id = (SELECT id FROM scenarios_scenario WHERE code = 'org-consultation') AND sort_order = 2), 'rationale', 'Uzasadnienie i korzyści dla mieszkańców', 'textarea', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3);

COMMIT;
