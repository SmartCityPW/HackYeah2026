-- =============================================================================
-- Smart City Go: schemat bazy danych
-- PostgreSQL 15+ z rozszerzeniami PostGIS i citext.
--
-- Konwencje:
--   * tabele nazwane jak w Django: <aplikacja>_<model> (accounts, scenarios, collection, pokestops, game),
--     każda aplikacja ma jedną odpowiedzialność (SRP),
--   * czas zawsze w timestamptz (UTC), współrzędne w geography(Point, 4326) (lng, lat),
--   * stany i rodzaje jako typy ENUM, reguły spójności jako CHECK i klucze złożone,
--   * to jest docelowy kształt bazy: modele Django mają go odwzorować,
--     a migracje (`makemigrations`) wygenerują właściwy DDL. Plik służy jako wzorzec i do szybkiej inicjalizacji.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

-- ----------------------------------------------------------------------------
-- Typy wyliczeniowe
-- ----------------------------------------------------------------------------
CREATE TYPE user_role           AS ENUM ('resident', 'org', 'admin');
CREATE TYPE organization_kind   AS ENUM ('ngo', 'foundation', 'association', 'city_office', 'district_council', 'municipality', 'other');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'suspended');
CREATE TYPE org_member_role     AS ENUM ('owner', 'editor');

CREATE TYPE scenario_audience   AS ENUM ('resident', 'org');
CREATE TYPE scenario_category   AS ENUM ('problem', 'initiative', 'place');
CREATE TYPE field_type          AS ENUM ('text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'tags', 'date', 'photos', 'character', 'choice', 'rating');

CREATE TYPE pokestop_type       AS ENUM ('report', 'idea', 'place', 'ngo', 'consultation');
CREATE TYPE pokestop_status     AS ENUM ('open', 'in_progress', 'resolved', 'rejected');
CREATE TYPE vote_value          AS ENUM ('for', 'against');

CREATE TYPE award_source        AS ENUM ('vote', 'report_confirmed', 'encounter');
CREATE TYPE enemy_action_kind   AS ENUM ('checkin', 'photo', 'qr', 'dwell');
CREATE TYPE encounter_status    AS ENUM ('active', 'defeated', 'expired');
CREATE TYPE attack_outcome      AS ENUM ('won', 'too_far', 'rejected', 'expired');

-- ----------------------------------------------------------------------------
-- Funkcje pomocnicze
-- ----------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- accounts: użytkownicy, role, organizacje
-- ============================================================================
CREATE TABLE accounts_user (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         citext UNIQUE,                      -- NULL dla gościa
    password_hash varchar(255),                       -- NULL dla gościa
    display_name  varchar(60)  NOT NULL,
    role          user_role    NOT NULL DEFAULT 'resident',
    is_guest      boolean      NOT NULL DEFAULT false, -- anonimowe konto na start, "zapisz postęp" później
    is_active     boolean      NOT NULL DEFAULT true,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    CONSTRAINT user_registered_has_credentials CHECK (is_guest OR (email IS NOT NULL AND password_hash IS NOT NULL)),
    CONSTRAINT user_guest_is_resident          CHECK (NOT is_guest OR role = 'resident')
);

CREATE TABLE accounts_organization (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                varchar(150)        NOT NULL UNIQUE,
    kind                organization_kind   NOT NULL,
    krs                 varchar(10),
    contact_person      varchar(100),
    contact_email       citext,
    contact_phone       varchar(30),
    verification_status verification_status NOT NULL DEFAULT 'pending',
    verified_at         timestamptz,
    verified_by_id      bigint REFERENCES accounts_user (id) ON DELETE SET NULL,
    created_at          timestamptz         NOT NULL DEFAULT now(),
    updated_at          timestamptz         NOT NULL DEFAULT now(),
    CONSTRAINT organization_verified_has_date CHECK ((verification_status = 'verified') = (verified_at IS NOT NULL))
);

CREATE TABLE accounts_organization_member (
    organization_id bigint          NOT NULL REFERENCES accounts_organization (id) ON DELETE CASCADE,
    user_id         bigint          NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    member_role     org_member_role NOT NULL DEFAULT 'editor',
    joined_at       timestamptz     NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX accounts_organization_member_user_idx ON accounts_organization_member (user_id);

-- ============================================================================
-- collection: postacie ("Spryciaki") i zdobywanie ich przez graczy
-- (słownik postaci jest tu, bo korzystają z niego scenariusze, pinezki i nagrody)
-- ============================================================================
CREATE TABLE collection_character (
    id             smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           varchar(32)  NOT NULL UNIQUE,      -- np. 'cyclist', 'bin', 'tree'
    label          varchar(60)  NOT NULL,
    emoji          varchar(8)   NOT NULL,
    category_label varchar(60)  NOT NULL,
    model_path     varchar(255),                      -- ścieżka do modelu 3D (glb)
    is_active      boolean      NOT NULL DEFAULT true
);

-- ============================================================================
-- scenarios: katalog formularzy (scenariuszy zgłoszeń) edytowalny przez administratora
-- ============================================================================
CREATE TABLE scenarios_scenario (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                 varchar(60)       NOT NULL UNIQUE,   -- np. 'org-bus-stop', 'place-food'
    audience             scenario_audience NOT NULL,
    category             scenario_category,                    -- tylko dla mieszkańców (menu "Zgłoś")
    pokestop_type        pokestop_type     NOT NULL,
    label                varchar(100)      NOT NULL,
    description          text              NOT NULL DEFAULT '',
    emoji                varchar(8)        NOT NULL,
    default_character_id smallint          NOT NULL REFERENCES collection_character (id),
    default_title        varchar(80),
    sort_order           smallint          NOT NULL DEFAULT 0,
    version              integer           NOT NULL DEFAULT 1,  -- rośnie przy zmianie pól (zgłoszenia zapamiętują wersję)
    is_active            boolean           NOT NULL DEFAULT true,
    created_at           timestamptz       NOT NULL DEFAULT now(),
    updated_at           timestamptz       NOT NULL DEFAULT now(),
    UNIQUE (id, pokestop_type),                                 -- cel klucza złożonego z pinezek
    CONSTRAINT scenario_type_matches_category CHECK (
        (audience = 'resident' AND (
              (category = 'problem'    AND pokestop_type = 'report')
           OR (category = 'initiative' AND pokestop_type = 'idea')
           OR (category = 'place'      AND pokestop_type = 'place')))
        OR
        (audience = 'org' AND category IS NULL AND pokestop_type IN ('ngo', 'consultation'))
    )
);

CREATE TABLE scenarios_section (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scenario_id bigint       NOT NULL REFERENCES scenarios_scenario (id) ON DELETE CASCADE,
    title       varchar(100) NOT NULL,
    sort_order  smallint     NOT NULL DEFAULT 0,
    UNIQUE (id, scenario_id)
);

CREATE TABLE scenarios_field (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scenario_id   bigint       NOT NULL,
    section_id    bigint       NOT NULL,
    field_key     varchar(40)  NOT NULL,               -- klucz w `details` zgłoszenia (title/description/photos/character trafiają do kolumn)
    label         varchar(150) NOT NULL,
    field_type    field_type   NOT NULL,
    required      boolean      NOT NULL DEFAULT false,
    hint          text,
    placeholder   varchar(120),
    unit          varchar(16),
    min_value     numeric,
    max_value     numeric,
    show_if_key   varchar(40),                         -- pole widoczne tylko, gdy inne pole ma daną wartość
    show_if_value jsonb,
    sort_order    smallint     NOT NULL DEFAULT 0,
    FOREIGN KEY (section_id, scenario_id) REFERENCES scenarios_section (id, scenario_id) ON DELETE CASCADE,
    UNIQUE (scenario_id, field_key),
    UNIQUE (id, scenario_id),
    CONSTRAINT field_show_if_complete CHECK ((show_if_key IS NULL) = (show_if_value IS NULL)),
    CONSTRAINT field_range_valid      CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE TABLE scenarios_field_option (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    field_id   bigint       NOT NULL REFERENCES scenarios_field (id) ON DELETE CASCADE,
    value      varchar(60)  NOT NULL,
    label      varchar(120) NOT NULL,
    sort_order smallint     NOT NULL DEFAULT 0,
    UNIQUE (field_id, value)
);

-- ============================================================================
-- pokestops: pinezki na mapie, głosy, komentarze, zdjęcia
-- ============================================================================
CREATE TABLE pokestops_pokestop (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type            pokestop_type   NOT NULL,
    status          pokestop_status NOT NULL DEFAULT 'open',
    scenario_id     bigint          NOT NULL,
    scenario_version integer        NOT NULL,           -- wersja scenariusza w chwili zgłoszenia
    character_id    smallint        NOT NULL REFERENCES collection_character (id),
    author_id       bigint          NOT NULL REFERENCES accounts_user (id) ON DELETE RESTRICT,
    organization_id bigint          REFERENCES accounts_organization (id) ON DELETE RESTRICT,
    title           varchar(80)     NOT NULL,
    description     text            NOT NULL DEFAULT '',
    location        geography(Point, 4326) NOT NULL,
    details         jsonb           NOT NULL DEFAULT '{}'::jsonb,  -- pola scenariusza; walidowane aplikacyjnie względem definicji
    votes_for       integer         NOT NULL DEFAULT 0,            -- liczniki utrzymywane triggerem
    votes_against   integer         NOT NULL DEFAULT 0,
    rejection_reason text,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),
    FOREIGN KEY (scenario_id, type) REFERENCES scenarios_scenario (id, pokestop_type),  -- typ pinezki = typ scenariusza
    CONSTRAINT pokestop_title_not_blank   CHECK (char_length(btrim(title)) >= 3),
    CONSTRAINT pokestop_details_is_object CHECK (jsonb_typeof(details) = 'object'),
    CONSTRAINT pokestop_votes_non_negative CHECK (votes_for >= 0 AND votes_against >= 0),
    CONSTRAINT pokestop_org_for_org_types CHECK ((type IN ('ngo', 'consultation')) = (organization_id IS NOT NULL)),
    CONSTRAINT pokestop_rejection_reason  CHECK (rejection_reason IS NULL OR status = 'rejected')
);
CREATE INDEX pokestops_pokestop_location_idx ON pokestops_pokestop USING gist (location);
CREATE INDEX pokestops_pokestop_status_type_idx ON pokestops_pokestop (status, type);
CREATE INDEX pokestops_pokestop_author_idx ON pokestops_pokestop (author_id);
CREATE INDEX pokestops_pokestop_org_idx ON pokestops_pokestop (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX pokestops_pokestop_created_idx ON pokestops_pokestop (created_at DESC);

CREATE TABLE pokestops_photo (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id  bigint       REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,  -- NULL do czasu podpięcia przy tworzeniu zgłoszenia
    uploaded_by_id bigint     NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    storage_key  varchar(255) NOT NULL UNIQUE,         -- ścieżka w magazynie obiektów (S3 lub dysk)
    content_type varchar(60)  NOT NULL,
    size_bytes   integer      NOT NULL,
    width        smallint,
    height       smallint,
    sort_order   smallint     NOT NULL DEFAULT 0,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT photo_content_type_image CHECK (content_type LIKE 'image/%'),
    CONSTRAINT photo_size_limit         CHECK (size_bytes > 0 AND size_bytes <= 5 * 1024 * 1024),
    CONSTRAINT photo_max_three          CHECK (sort_order BETWEEN 0 AND 2),
    UNIQUE (pokestop_id, sort_order)
);

CREATE TABLE pokestops_vote (
    pokestop_id bigint     NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    user_id     bigint     NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    vote        vote_value NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pokestop_id, user_id)                 -- jeden głos na użytkownika
);
CREATE INDEX pokestops_vote_user_idx ON pokestops_vote (user_id, created_at DESC);

CREATE TABLE pokestops_comment (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id bigint       NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    author_id   bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    body        varchar(300) NOT NULL,
    hidden_at   timestamptz,                           -- ukryty przez moderatora
    hidden_by_id bigint      REFERENCES accounts_user (id) ON DELETE SET NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT comment_body_not_blank CHECK (char_length(btrim(body)) >= 1)
);
CREATE INDEX pokestops_comment_pokestop_idx ON pokestops_comment (pokestop_id, created_at);
CREATE INDEX pokestops_comment_author_idx ON pokestops_comment (author_id);

CREATE TABLE pokestops_status_change (                 -- ślad audytowy zmian statusu (moderacja)
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id bigint          NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    from_status pokestop_status NOT NULL,
    to_status   pokestop_status NOT NULL,
    changed_by_id bigint        REFERENCES accounts_user (id) ON DELETE SET NULL,
    note        text,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT status_change_differs CHECK (from_status <> to_status)
);
CREATE INDEX pokestops_status_change_pokestop_idx ON pokestops_status_change (pokestop_id, created_at);

-- Liczniki głosów utrzymywane przez bazę (spójne nawet przy równoległych głosach).
CREATE FUNCTION pokestops_vote_apply_counters() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        UPDATE pokestops_pokestop
           SET votes_for     = votes_for     - (OLD.vote = 'for')::int,
               votes_against = votes_against - (OLD.vote = 'against')::int
         WHERE id = OLD.pokestop_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE pokestops_pokestop
           SET votes_for     = votes_for     + (NEW.vote = 'for')::int,
               votes_against = votes_against + (NEW.vote = 'against')::int
         WHERE id = NEW.pokestop_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER pokestops_vote_counters
    AFTER INSERT OR UPDATE OF vote OR DELETE ON pokestops_vote
    FOR EACH ROW EXECUTE FUNCTION pokestops_vote_apply_counters();

-- ============================================================================
-- game: przeciwnicy, walki, postęp gracza (logika gry i antyoszustwo po stronie serwera)
-- ============================================================================
CREATE TABLE game_enemy_type (                          -- szablony, z których serwer losuje przeciwników
    id            smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          varchar(32)       NOT NULL UNIQUE,
    name          varchar(80)       NOT NULL,
    emoji         varchar(8)        NOT NULL,
    description   text              NOT NULL DEFAULT '',
    action_kind   enemy_action_kind NOT NULL DEFAULT 'checkin',   -- jak potwierdzamy akcję na miejscu
    action_label  varchar(200)      NOT NULL,
    min_level     smallint          NOT NULL DEFAULT 1,
    max_level     smallint          NOT NULL DEFAULT 5,
    base_xp       integer           NOT NULL,
    spawn_weight  smallint          NOT NULL DEFAULT 1,           -- waga losowania
    is_active     boolean           NOT NULL DEFAULT true,
    CONSTRAINT enemy_level_range CHECK (min_level >= 1 AND min_level <= max_level),
    CONSTRAINT enemy_xp_positive CHECK (base_xp > 0),
    CONSTRAINT enemy_weight_positive CHECK (spawn_weight > 0)
);

CREATE TABLE game_encounter (                           -- konkretny przeciwnik na mapie
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enemy_type_id smallint         NOT NULL REFERENCES game_enemy_type (id),
    level         smallint         NOT NULL,
    xp_reward     integer          NOT NULL,                      -- migawka nagrody w chwili wygenerowania
    location      geography(Point, 4326) NOT NULL,
    status        encounter_status NOT NULL DEFAULT 'active',
    spawned_at    timestamptz      NOT NULL DEFAULT now(),
    expires_at    timestamptz      NOT NULL,
    defeated_by_id bigint          REFERENCES accounts_user (id) ON DELETE SET NULL,
    defeated_at   timestamptz,
    CONSTRAINT encounter_level_range   CHECK (level BETWEEN 1 AND 100),
    CONSTRAINT encounter_xp_positive   CHECK (xp_reward > 0),
    CONSTRAINT encounter_expires_after CHECK (expires_at > spawned_at),
    CONSTRAINT encounter_defeat_consistent CHECK (
        (status = 'defeated') = (defeated_at IS NOT NULL)
        AND (status <> 'defeated' OR defeated_by_id IS NOT NULL)
    )
);
CREATE INDEX game_encounter_active_location_idx ON game_encounter USING gist (location) WHERE status = 'active';
CREATE INDEX game_encounter_active_expiry_idx ON game_encounter (expires_at) WHERE status = 'active';

CREATE TABLE game_attack (                              -- każda próba ataku: dziennik do wykrywania oszustw
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_id bigint         NOT NULL REFERENCES game_encounter (id) ON DELETE CASCADE,
    user_id      bigint         NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    location     geography(Point, 4326) NOT NULL,              -- pozycja zgłoszona przez klienta
    distance_m   numeric(9, 1)  NOT NULL,                      -- odległość policzona przez serwer
    accuracy_m   numeric(8, 1),                                -- deklarowana dokładność GPS
    client_time  timestamptz,
    outcome      attack_outcome NOT NULL,
    reason       text,
    created_at   timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT attack_distance_non_negative CHECK (distance_m >= 0)
);
-- Tylko jedno zwycięstwo na przeciwnika, nawet przy równoległych żądaniach.
CREATE UNIQUE INDEX game_attack_one_win_per_encounter ON game_attack (encounter_id) WHERE outcome = 'won';
CREATE INDEX game_attack_user_time_idx ON game_attack (user_id, created_at DESC);   -- limity częstotliwości

CREATE TABLE game_player_progress (
    user_id    bigint PRIMARY KEY REFERENCES accounts_user (id) ON DELETE CASCADE,
    xp         bigint      NOT NULL DEFAULT 0,             -- poziom wylicza aplikacja z xp (wzór może się zmieniać)
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT progress_xp_non_negative CHECK (xp >= 0)
);

-- ============================================================================
-- collection: nagrody (dziennik zdobytych postaci)
-- ============================================================================
CREATE TABLE collection_award (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    character_id smallint     NOT NULL REFERENCES collection_character (id),
    source       award_source NOT NULL,
    pokestop_id  bigint       REFERENCES pokestops_pokestop (id) ON DELETE SET NULL,
    encounter_id bigint       REFERENCES game_encounter (id) ON DELETE SET NULL,
    awarded_at   timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (user_id, pokestop_id, source),             -- jedna nagroda za dany głos i za potwierdzone zgłoszenie
    UNIQUE (user_id, encounter_id),
    CONSTRAINT award_source_matches_reference CHECK (
        (source IN ('vote', 'report_confirmed') AND pokestop_id IS NOT NULL AND encounter_id IS NULL)
        OR (source = 'encounter' AND encounter_id IS NOT NULL AND pokestop_id IS NULL)
    )
);
CREATE INDEX collection_award_user_idx ON collection_award (user_id, character_id);

-- Kolekcja gracza ("Moje Spryciaki"): liczba zdobytych sztuk każdej postaci.
CREATE VIEW collection_user_character AS
SELECT user_id, character_id, count(*)::int AS quantity, min(awarded_at) AS first_awarded_at
  FROM collection_award
 GROUP BY user_id, character_id;

-- ----------------------------------------------------------------------------
-- Triggery updated_at
-- ----------------------------------------------------------------------------
CREATE TRIGGER accounts_user_updated         BEFORE UPDATE ON accounts_user         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER accounts_organization_updated BEFORE UPDATE ON accounts_organization FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER scenarios_scenario_updated    BEFORE UPDATE ON scenarios_scenario    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pokestops_pokestop_updated    BEFORE UPDATE ON pokestops_pokestop    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER game_player_progress_updated  BEFORE UPDATE ON game_player_progress  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
