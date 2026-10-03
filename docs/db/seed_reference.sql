-- Dane słownikowe: typy, postacie i szablony przeciwników. Uruchomić po schema.sql, przed seed_scenarios.sql.
BEGIN;

INSERT INTO collection_type (code, name, emoji) VALUES
    ('transport', 'Transport',  '🚦'),
    ('clean',     'Czystość',   '🧹'),
    ('green',     'Zieleń',     '🌿'),
    ('energy',    'Energia',    '💡'),
    ('air',       'Powietrze',  '🌫️'),
    ('infra',     'Infrastruktura', '🧱');

-- base_power/power_growth: placeholder do wytuningowania; is_starter: jedna postać przyznawana na start konta.
INSERT INTO collection_character (code, label, emoji, category_label, model_path, type_id, base_power, power_growth, is_starter) VALUES
    ('cyclist', 'Rowerzysta',   '🚴', 'Rowery i ścieżki', NULL,                                                  (SELECT id FROM collection_type WHERE code = 'transport'), 20, 4, true),
    ('bin',     'Stworek Kosz', '🗑️', 'Czystość i śmieci', NULL,                                                 (SELECT id FROM collection_type WHERE code = 'clean'),     15, 4, false),
    ('tree',    'Drzewo',       '🌳', 'Zieleń',            'models/kenney-mini-forest/tree.glb',                 (SELECT id FROM collection_type WHERE code = 'green'),     18, 4, false),
    ('train',   'Pociąg',       '🚆', 'Komunikacja',       'models/kenney-train-kit/train-electric-city-a.glb',  (SELECT id FROM collection_type WHERE code = 'transport'), 25, 5, false),
    ('lamp',    'Latarnia',     '💡', 'Oświetlenie',       'models/kenney-city-kit-roads/light-curved.glb',      (SELECT id FROM collection_type WHERE code = 'energy'),    12, 3, false);

-- Unikalny pokemon za udział w wydarzeniu (nie wypada z walk ani ankiet).
INSERT INTO collection_character (code, label, emoji, category_label, model_path, type_id, base_power, power_growth, is_event_exclusive) VALUES
    ('festival', 'Maskotka Festiwalu', '🎪', 'Wydarzenia', NULL, (SELECT id FROM collection_type WHERE code = 'infra'), 22, 5, true);

-- base_power/power_growth: moc przeciwnika na poziomie 1 i przyrost na poziom (placeholder do wytuningowania).
INSERT INTO game_enemy_type (code, name, emoji, description, type_id, action_kind, action_label, min_level, max_level, base_power, power_growth, base_xp, spawn_weight) VALUES
    ('traffic_jam',   'Korek Komunikacyjny', '🚗',  'Zablokował skrzyżowanie i nie chce odjechać.',       (SELECT id FROM collection_type WHERE code = 'transport'), 'checkin', 'Stań przy skrzyżowaniu i rozładuj korek',               2, 4, 30, 10, 40, 3),
    ('trash_beast',   'Śmieciowy Potwór',    '🗑️', 'Rośnie przy każdym wyrzuconym papierku.',            (SELECT id FROM collection_type WHERE code = 'clean'),     'checkin', 'Wyrzuć jedną śmieć do kosza w pobliżu',                 1, 3, 20, 8,  25, 4),
    ('smog_ghost',    'Smogowy Duch',        '🌫️', 'Unosi się nad miastem w zimne dni.',                 (SELECT id FROM collection_type WHERE code = 'air'),       'dwell',   'Weź kilka głębokich wdechów, ale daleko od ulicy',      3, 5, 45, 12, 55, 2),
    ('concrete_golem','Betonowy Golem',      '🧱',  'Zabetonował skwer, na którym miała rosnąć trawa.',   (SELECT id FROM collection_type WHERE code = 'infra'),     'checkin', 'Dotknij najbliższego drzewa',                           4, 6, 60, 15, 70, 1);

COMMIT;
