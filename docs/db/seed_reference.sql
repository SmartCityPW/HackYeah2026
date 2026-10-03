-- Dane słownikowe: postacie i szablony przeciwników. Uruchomić po schema.sql, przed seed_scenarios.sql.
BEGIN;

INSERT INTO collection_character (code, label, emoji, category_label, model_path) VALUES
    ('cyclist', 'Rowerzysta',   '🚴', 'Rowery i ścieżki', NULL),                                  -- model budowany w kodzie frontendu
    ('bin',     'Stworek Kosz', '🗑️', 'Czystość i śmieci', NULL),                                 -- model budowany w kodzie frontendu
    ('tree',    'Drzewo',       '🌳', 'Zieleń',            'models/kenney-mini-forest/tree.glb'),
    ('train',   'Pociąg',       '🚆', 'Komunikacja',       'models/kenney-train-kit/train-electric-city-a.glb'),
    ('lamp',    'Latarnia',     '💡', 'Oświetlenie',       'models/kenney-city-kit-roads/light-curved.glb');

INSERT INTO game_enemy_type (code, name, emoji, description, action_kind, action_label, min_level, max_level, base_xp, spawn_weight) VALUES
    ('traffic_jam',  'Korek Komunikacyjny', '🚗', 'Zablokował skrzyżowanie i nie chce odjechać.',       'checkin', 'Stań przy skrzyżowaniu i rozładuj korek',               2, 4, 40, 3),
    ('trash_beast',  'Śmieciowy Potwór',    '🗑️', 'Rośnie przy każdym wyrzuconym papierku.',            'checkin', 'Wyrzuć jedną śmieć do kosza w pobliżu',                 1, 3, 25, 4),
    ('smog_ghost',   'Smogowy Duch',        '🌫️', 'Unosi się nad miastem w zimne dni.',                 'dwell',   'Weź kilka głębokich wdechów, ale daleko od ulicy',      3, 5, 55, 2),
    ('concrete_golem','Betonowy Golem',     '🧱', 'Zabetonował skwer, na którym miała rosnąć trawa.',   'checkin', 'Dotknij najbliższego drzewa',                           4, 6, 70, 1);

COMMIT;
