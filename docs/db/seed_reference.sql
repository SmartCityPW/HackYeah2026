-- WYGENEROWANY PLIK: nie edytować ręcznie. Źródło: backend/config/seed/reference.yaml
-- Odtworzenie: (cd backend && python manage.py export_reference)
-- Dane słownikowe: typy, postacie i szablony przeciwników. Uruchomić po schema.sql, przed seed_scenarios.sql.
BEGIN;

INSERT INTO collection_type (code, name, emoji) VALUES
    ('transport', 'Transport', '🚦'),
    ('clean', 'Czystość', '🧹'),
    ('green', 'Zieleń', '🌿'),
    ('energy', 'Energia', '💡'),
    ('air', 'Powietrze', '🌫️'),
    ('infra', 'Infrastruktura', '🧱');

INSERT INTO collection_character (code, label, emoji, category_label, model_path, type_id, base_power, power_growth, is_starter, is_event_exclusive) VALUES
    ('bicycle', 'Rower', '🚲', 'Rowery i ścieżki', 'models/spryciaki/bicycle.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 20, 4, true, false),
    ('car', 'Samochód', '🚗', 'Ruch uliczny', 'models/spryciaki/car.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 22, 4, false, false),
    ('small_car', 'Autko', '🚘', 'Ruch uliczny', 'models/spryciaki/small_car.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 18, 4, false, false),
    ('suv', 'SUV', '🚙', 'Ruch uliczny', 'models/spryciaki/suv.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 26, 5, false, false),
    ('sports_car', 'Auto sportowe', '🏎️', 'Ruch uliczny', 'models/spryciaki/sports_car.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 24, 5, false, false),
    ('van', 'Furgonetka', '🚐', 'Dostawy i usługi', 'models/spryciaki/van.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 25, 5, false, false),
    ('trash_can', 'Kosz na śmieci', '🗑️', 'Czystość', 'models/spryciaki/trash_can.glb', (SELECT id FROM collection_type WHERE code = 'clean'), 15, 4, false, false),
    ('dumpster', 'Kontener na śmieci', '♻️', 'Odpady', 'models/spryciaki/dumpster.glb', (SELECT id FROM collection_type WHERE code = 'clean'), 21, 5, false, false),
    ('tree', 'Drzewo', '🌳', 'Zieleń', 'models/spryciaki/tree.glb', (SELECT id FROM collection_type WHERE code = 'green'), 18, 4, false, false),
    ('potted_tree', 'Drzewko w donicy', '🪴', 'Zieleń na ulicy', 'models/spryciaki/potted_tree.glb', (SELECT id FROM collection_type WHERE code = 'green'), 14, 3, false, false),
    ('flower_pot', 'Kwiaty w donicy', '🌷', 'Zieleń na ulicy', 'models/spryciaki/flower_pot.glb', (SELECT id FROM collection_type WHERE code = 'green'), 12, 3, false, false),
    ('air_conditioner', 'Klimatyzator', '❄️', 'Powietrze i klimat', 'models/spryciaki/air_conditioner.glb', (SELECT id FROM collection_type WHERE code = 'air'), 17, 4, false, false),
    ('billboard', 'Billboard', '🪧', 'Reklama i światło', 'models/spryciaki/billboard.glb', (SELECT id FROM collection_type WHERE code = 'energy'), 16, 4, false, false),
    ('bench', 'Ławka', '🪑', 'Mała architektura', 'models/spryciaki/bench.glb', (SELECT id FROM collection_type WHERE code = 'infra'), 13, 3, false, false),
    ('cone', 'Pachołek', '🚧', 'Roboty drogowe', 'models/spryciaki/cone.glb', (SELECT id FROM collection_type WHERE code = 'infra'), 12, 3, false, false),
    ('fire_hydrant', 'Hydrant', '🧯', 'Sieć wodna', 'models/spryciaki/fire_hydrant.glb', (SELECT id FROM collection_type WHERE code = 'infra'), 19, 4, false, false),
    ('floor_hole', 'Dziura w chodniku', '🕳️', 'Chodniki', 'models/spryciaki/floor_hole.glb', (SELECT id FROM collection_type WHERE code = 'infra'), 16, 4, false, false),
    ('gold_bike', 'Złoty Rower', '🥇', 'Wydarzenia rowerowe', 'models/spryciaki/bicycle.glb', (SELECT id FROM collection_type WHERE code = 'transport'), 40, 6, false, true),
    ('shiny_bin', 'Błyszczący Kosz', '✨', 'Wydarzenia sprzątające', NULL, (SELECT id FROM collection_type WHERE code = 'clean'), 36, 6, false, true),
    ('giant_tree', 'Zielony Gigant', '🌲', 'Wydarzenia zielone', NULL, (SELECT id FROM collection_type WHERE code = 'green'), 42, 6, false, true),
    ('lantern', 'Lampion Festiwalowy', '🏮', 'Festiwale i koncerty', NULL, (SELECT id FROM collection_type WHERE code = 'energy'), 38, 6, false, true),
    ('cloud_kite', 'Chmurka-Latawiec', '🪁', 'Wydarzenia plenerowe', NULL, (SELECT id FROM collection_type WHERE code = 'air'), 37, 6, false, true),
    ('mural_beast', 'Mural-Stwór', '🎨', 'Sztuka w mieście', NULL, (SELECT id FROM collection_type WHERE code = 'infra'), 39, 6, false, true);

INSERT INTO game_enemy_type (code, name, emoji, description, type_id, action_kind, action_label, min_level, max_level, base_power, power_growth, base_xp, spawn_weight) VALUES
    ('traffic_jam', 'Korek Komunikacyjny', '🚗', 'Zablokował skrzyżowanie i nie chce odjechać.', (SELECT id FROM collection_type WHERE code = 'transport'), 'checkin', 'Stań przy skrzyżowaniu i rozładuj korek', 2, 4, 30, 10, 40, 3),
    ('trash_beast', 'Śmieciowy Potwór', '🗑️', 'Rośnie przy każdym wyrzuconym papierku.', (SELECT id FROM collection_type WHERE code = 'clean'), 'checkin', 'Wyrzuć jedną śmieć do kosza w pobliżu', 1, 3, 20, 8, 25, 4),
    ('smog_ghost', 'Smogowy Duch', '🌫️', 'Unosi się nad miastem w zimne dni.', (SELECT id FROM collection_type WHERE code = 'air'), 'dwell', 'Weź kilka głębokich wdechów, ale daleko od ulicy', 3, 5, 45, 12, 55, 2),
    ('concrete_golem', 'Betonowy Golem', '🧱', 'Zabetonował skwer', (SELECT id FROM collection_type WHERE code = 'infra'), 'checkin', 'Dotknij najbliższego drzewa', 4, 6, 60, 15, 70, 1);

COMMIT;
