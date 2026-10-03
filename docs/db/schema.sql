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
--
-- v5: przeciwnicy przypisani do kwadratów terenu (game_encounter_cell, game_encounter.cell_id), wspólni dla graczy;
--     game_attack zapisuje też próby odrzucone (antyoszustwo) i poza zasięgiem.
--
-- v4: zgodność z docs/opis.md: wydarzenia (events_*), ankiety (pokestops_question/_survey_*), głosowanie i ankiety
--     tylko w zasięgu punktu (pozycja zapisywana przy głosie), agent AI zwraca tylko tak/nie.
--
-- v3: usunięty cykl collection <-> game (nagroda za walkę wskazuje pokemona z game_attack), stałe nagród przeniesione
--     z triggerów do aplikacji (baza zapisuje tylko wynik), log moderacji AI, zwalnianie zastawu po odrzuceniu/rozwiązaniu.
--     Patrz docs/db/README.md.
--
-- v2: przywrócona pełna mechanika walki (moc, typ, mnożnik, wybór 3 pokemonów) zamiast samego
-- check-inu lokalizacyjnego — patrz docs/db/README.md, sekcja "Walka pokemonami".
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

CREATE TYPE pokemon_origin      AS ENUM ('starter', 'encounter', 'survey', 'event');   -- jedyne zdarzenia, które dają NOWEGO pokemona (patrz README)
CREATE TYPE moderation_verdict  AS ENUM ('approved', 'rejected', 'error');    -- 'error': agent AI nie odpowiedział (zgłoszenie nie powstaje, użytkownik ponawia)
CREATE TYPE event_status        AS ENUM ('scheduled', 'cancelled');
CREATE TYPE enemy_action_kind   AS ENUM ('checkin', 'photo', 'qr', 'dwell');
CREATE TYPE encounter_status    AS ENUM ('active', 'defeated', 'expired');
CREATE TYPE attack_outcome      AS ENUM ('won', 'lost', 'too_far', 'rejected', 'expired');  -- 'lost': w zasięgu, ale moc nie wystarczyła

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
-- collection: typy, postacie ("Spryciaki") i posiadane pokemony (zależy tylko od accounts)
-- (słownik postaci jest tu, bo korzystają z niego scenariusze, pinezki i nagrody)
-- ============================================================================
CREATE TABLE collection_type (                          -- "typ" postaci i przeciwnika (do mnożnika w walce)
    id    smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  varchar(32) NOT NULL UNIQUE,                  -- np. 'transport', 'clean', 'green'
    name  varchar(60) NOT NULL,
    emoji varchar(8)  NOT NULL
);

CREATE TABLE collection_character (
    id             smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           varchar(32)  NOT NULL UNIQUE,      -- np. 'cyclist', 'bin', 'tree'
    label          varchar(60)  NOT NULL,
    emoji          varchar(8)   NOT NULL,
    category_label varchar(60)  NOT NULL,
    model_path     varchar(255),                      -- ścieżka do modelu 3D (glb)
    type_id        smallint     NOT NULL REFERENCES collection_type (id),   -- typ do walki (mnożnik 1.2 przy zgodności z typem wroga)
    base_power     smallint     NOT NULL,              -- moc na poziomie 1
    power_growth   smallint     NOT NULL DEFAULT 5,    -- przyrost mocy na poziom (wzór wyliczany aplikacyjnie z exp, jak XP gracza)
    is_starter     boolean      NOT NULL DEFAULT false, -- postać przyznawana jako pierwszy pokemon przy rejestracji/koncie gościa
    is_event_exclusive boolean  NOT NULL DEFAULT false, -- "unikalny pokemon" za udział w wydarzeniu: nie wypada z walk ani ankiet
    is_active      boolean      NOT NULL DEFAULT true,
    CONSTRAINT character_base_power_positive   CHECK (base_power > 0),
    CONSTRAINT character_power_growth_positive CHECK (power_growth > 0),
    CONSTRAINT character_starter_not_exclusive CHECK (NOT (is_starter AND is_event_exclusive))
);
-- Tylko jedna postać startowa w słowniku.
CREATE UNIQUE INDEX collection_character_one_starter_species ON collection_character (is_starter) WHERE is_starter;

CREATE TABLE collection_pokemon (                       -- konkretny, posiadany egzemplarz (stan mutowalny: exp, czy jest "na zgłoszeniu")
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    character_id smallint     NOT NULL REFERENCES collection_character (id),
    origin       pokemon_origin NOT NULL,                -- skąd pochodzi: start konta albo nagroda za wygraną walkę (patrz game_attack.reward_pokemon_id)
    nickname     varchar(60),
    exp          bigint       NOT NULL DEFAULT 0,       -- poziom i moc wylicza aplikacja z (character.base_power/power_growth, exp), wzór może się zmieniać
    is_staked    boolean      NOT NULL DEFAULT false,   -- zostawiony na własnym zgłoszeniu/pomyśle, niedostępny do walki (patrz pokestops_pokestop.staked_pokemon_id)
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pokemon_exp_non_negative CHECK (exp >= 0)
);
CREATE INDEX collection_pokemon_user_idx ON collection_pokemon (user_id);
CREATE INDEX collection_pokemon_available_idx ON collection_pokemon (user_id) WHERE NOT is_staked;
-- Jeden pokemon startowy na użytkownika (przyznawany przy /auth/guest i /auth/register).
CREATE UNIQUE INDEX collection_pokemon_one_starter_per_user ON collection_pokemon (user_id) WHERE origin = 'starter';

-- Kolekcja gracza ("Moje Spryciaki"): liczba posiadanych sztuk każdej postaci.
CREATE VIEW collection_user_character AS
SELECT user_id, character_id, count(*)::int AS quantity, min(created_at) AS first_caught_at
  FROM collection_pokemon
 GROUP BY user_id, character_id;

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
    votes_required        smallint          NOT NULL DEFAULT 10, -- próg głosów "za", przy którym zgłoszenie się potwierdza (patrz pokestops_pokestop)
    sort_order           smallint          NOT NULL DEFAULT 0,
    version              integer           NOT NULL DEFAULT 1,  -- rośnie przy zmianie pól (zgłoszenia zapamiętują wersję)
    is_active            boolean           NOT NULL DEFAULT true,
    created_at           timestamptz       NOT NULL DEFAULT now(),
    updated_at           timestamptz       NOT NULL DEFAULT now(),
    UNIQUE (id, pokestop_type),                                 -- cel klucza złożonego z pinezek
    CONSTRAINT scenario_votes_required_positive CHECK (votes_required > 0),
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
    character_id    smallint        NOT NULL REFERENCES collection_character (id),  -- gatunek widoczny na mapie (dla report/idea = gatunek zostawionego pokemona)
    author_id       bigint          NOT NULL REFERENCES accounts_user (id) ON DELETE RESTRICT,
    organization_id bigint          REFERENCES accounts_organization (id) ON DELETE RESTRICT,
    title           varchar(80)     NOT NULL,
    description     text            NOT NULL DEFAULT '',
    location        geography(Point, 4326) NOT NULL,
    details         jsonb           NOT NULL DEFAULT '{}'::jsonb,  -- pola scenariusza; walidowane aplikacyjnie względem definicji
    custom_fields   jsonb           NOT NULL DEFAULT '[]'::jsonb,  -- pola własne dopisywane przez organizatora: [{"label": ..., "value": ...}]
    votes_for       integer         NOT NULL DEFAULT 0,            -- liczniki utrzymywane triggerem
    votes_against   integer         NOT NULL DEFAULT 0,
    votes_required  smallint        NOT NULL,                      -- migawka scenarios_scenario.votes_required z chwili zgłoszenia
    staked_pokemon_id bigint        REFERENCES collection_pokemon (id) ON DELETE RESTRICT,   -- pokemon zostawiony przez autora (tylko report/idea)
    stake_released_at timestamptz,                                 -- kiedy zwrócono pokemona autorowi (próg głosów, rozwiązanie, odrzucenie lub wycofanie)
    stake_bonus_exp   integer,                                     -- exp dopisany przy zwrocie (0 przy odrzuceniu/wycofaniu); wartość z aplikacji, baza tylko zapisuje wynik
    rejection_reason text,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),
    FOREIGN KEY (scenario_id, type) REFERENCES scenarios_scenario (id, pokestop_type),  -- typ pinezki = typ scenariusza
    CONSTRAINT pokestop_title_not_blank   CHECK (char_length(btrim(title)) >= 3),
    CONSTRAINT pokestop_details_is_object CHECK (jsonb_typeof(details) = 'object'),
    CONSTRAINT pokestop_custom_fields_is_array CHECK (jsonb_typeof(custom_fields) = 'array'),
    CONSTRAINT pokestop_votes_non_negative CHECK (votes_for >= 0 AND votes_against >= 0),
    CONSTRAINT pokestop_votes_required_positive CHECK (votes_required > 0),
    CONSTRAINT pokestop_org_for_org_types CHECK ((type IN ('ngo', 'consultation')) = (organization_id IS NOT NULL)),
    CONSTRAINT pokestop_stake_matches_type CHECK ((type IN ('report', 'idea')) = (staked_pokemon_id IS NOT NULL)),  -- stawianie pokemona: tylko zgłoszenia/pomysły mieszkańców
    CONSTRAINT pokestop_stake_release_after_stake CHECK (stake_released_at IS NULL OR staked_pokemon_id IS NOT NULL),
    CONSTRAINT pokestop_stake_release_consistent  CHECK ((stake_released_at IS NULL) = (stake_bonus_exp IS NULL) AND (stake_bonus_exp IS NULL OR stake_bonus_exp >= 0)),
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
    rewarded_pokemon_id bigint NOT NULL REFERENCES collection_pokemon (id) ON DELETE RESTRICT,   -- pokemon głosującego, któremu przyznano exp za głos
    exp_granted integer    NOT NULL DEFAULT 0 CHECK (exp_granted >= 0),                          -- ile exp przyznano (wartość z aplikacji)
    location    geography(Point, 4326) NOT NULL,        -- pozycja głosującego (głos tylko w zasięgu punktu, sprawdza serwer)
    distance_m  numeric(9, 1)  NOT NULL CHECK (distance_m >= 0),   -- odległość od pinezki policzona przez serwer
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pokestop_id, user_id)                 -- jeden głos na użytkownika
);
CREATE INDEX pokestops_vote_user_idx ON pokestops_vote (user_id, created_at DESC);

CREATE TABLE pokestops_comment (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id bigint       NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    author_id   bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    parent_comment_id bigint REFERENCES pokestops_comment (id) ON DELETE CASCADE,  -- odpowiedź na inny komentarz (wątek)
    body        varchar(300) NOT NULL,
    hidden_at   timestamptz,                           -- ukryty przez moderatora
    hidden_by_id bigint      REFERENCES accounts_user (id) ON DELETE SET NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT comment_body_not_blank CHECK (char_length(btrim(body)) >= 1)
);
CREATE INDEX pokestops_comment_pokestop_idx ON pokestops_comment (pokestop_id, created_at);
CREATE INDEX pokestops_comment_author_idx ON pokestops_comment (author_id);
CREATE INDEX pokestops_comment_parent_idx ON pokestops_comment (parent_comment_id) WHERE parent_comment_id IS NOT NULL;

CREATE TABLE pokestops_status_change (                 -- ślad audytowy zmian statusu (moderacja)
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id bigint          NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    from_status pokestop_status NOT NULL,
    to_status   pokestop_status NOT NULL,
    changed_by_id bigint        REFERENCES accounts_user (id) ON DELETE SET NULL,  -- NULL = agent AI moderujący zgłoszenia
    note        text,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT status_change_differs CHECK (from_status <> to_status)
);
CREATE INDEX pokestops_status_change_pokestop_idx ON pokestops_status_change (pokestop_id, created_at);

CREATE TABLE pokestops_update (                        -- wpisy organizatora na osi czasu inicjatywy ("Dziś rada miasta zajęła się sprawą ...")
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id bigint       NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    author_id   bigint       REFERENCES accounts_user (id) ON DELETE SET NULL,
    title       varchar(120) NOT NULL,
    body        text         NOT NULL DEFAULT '',
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT update_title_not_blank CHECK (char_length(btrim(title)) >= 1)
);
CREATE INDEX pokestops_update_stop_idx ON pokestops_update (pokestop_id, created_at DESC);

CREATE TABLE pokestops_moderation_log (                -- werdykty agenta AI przy tworzeniu zgłoszeń mieszkańców (także odrzuconych, które nie trafiają do pokestops_pokestop)
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id   bigint             NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    scenario_id bigint             NOT NULL REFERENCES scenarios_scenario (id),
    pokestop_id bigint             REFERENCES pokestops_pokestop (id) ON DELETE SET NULL,  -- NULL dla odrzuconych (nic nie zapisano)
    submitted   jsonb              NOT NULL,                -- treść zgłoszenia oceniona przez agenta (tytuł, opis, pola)
    verdict     moderation_verdict NOT NULL,
    reason      text,                                       -- agent zwraca tylko tak/nie, więc tu trafia co najwyżej komunikat błędu (verdict = 'error')
    model       varchar(60),                                -- identyfikator modelu/wersji promptu, do porównań przy strojeniu
    latency_ms  integer,
    created_at  timestamptz        NOT NULL DEFAULT now(),
    CONSTRAINT moderation_only_approved_saved CHECK (verdict = 'approved' OR pokestop_id IS NULL)   -- odrzucone lub nieocenione zgłoszenie nie powstaje
);
CREATE INDEX pokestops_moderation_log_author_idx ON pokestops_moderation_log (author_id, created_at DESC);
CREATE INDEX pokestops_moderation_log_verdict_idx ON pokestops_moderation_log (verdict, created_at DESC);

-- ----------------------------------------------------------------------------
-- Ankiety: pytania zadane przez miasto lub organizację przy pinezce typu ngo/consultation (reguła typu w aplikacji).
-- Odpowiedź na wszystkie wymagane pytania daje NOWEGO pokemona gatunku pinezki (patrz README).
-- ----------------------------------------------------------------------------
CREATE TABLE pokestops_question (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id  bigint       NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    question_key varchar(40)  NOT NULL,                    -- klucz odpowiedzi w API
    label        varchar(300) NOT NULL,
    field_type   field_type   NOT NULL,
    required     boolean      NOT NULL DEFAULT true,
    options      jsonb,                                    -- [{"value": "...", "label": "..."}] dla select/choice/multiselect
    min_value    numeric,
    max_value    numeric,
    sort_order   smallint     NOT NULL DEFAULT 0,
    UNIQUE (pokestop_id, question_key),
    UNIQUE (pokestop_id, sort_order),
    UNIQUE (id, pokestop_id),                              -- cel klucza złożonego z odpowiedzi
    CONSTRAINT question_type_allowed  CHECK (field_type IN ('text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'choice', 'rating')),
    CONSTRAINT question_options_match CHECK ((field_type IN ('select', 'multiselect', 'choice')) = (options IS NOT NULL AND jsonb_typeof(options) = 'array')),
    CONSTRAINT question_range_valid   CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE TABLE pokestops_survey_response (                -- jedno wypełnienie ankiety przez użytkownika
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokestop_id       bigint       NOT NULL REFERENCES pokestops_pokestop (id) ON DELETE CASCADE,
    user_id           bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    location          geography(Point, 4326) NOT NULL,     -- pozycja przy wypełnianiu (tylko w zasięgu punktu, sprawdza serwer)
    distance_m        numeric(9, 1) NOT NULL CHECK (distance_m >= 0),
    reward_pokemon_id bigint       NOT NULL UNIQUE REFERENCES collection_pokemon (id) ON DELETE RESTRICT,  -- pokemon za ankietę (origin='survey')
    submitted_at      timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (pokestop_id, user_id),                         -- jedna ankieta na użytkownika
    UNIQUE (id, pokestop_id)
);
CREATE INDEX pokestops_survey_response_user_idx ON pokestops_survey_response (user_id);

CREATE TABLE pokestops_survey_answer (                  -- jedna odpowiedź na jedno pytanie (znormalizowane: łatwa agregacja wyników dla organizacji)
    response_id bigint NOT NULL,
    question_id bigint NOT NULL,
    pokestop_id bigint NOT NULL,
    value       jsonb  NOT NULL,                           -- tekst, liczba, wartość opcji, tablica opcji albo boolean
    PRIMARY KEY (response_id, question_id),
    FOREIGN KEY (response_id, pokestop_id) REFERENCES pokestops_survey_response (id, pokestop_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id, pokestop_id) REFERENCES pokestops_question (id, pokestop_id) ON DELETE CASCADE   -- pytanie z tej samej pinezki co odpowiedź
);
CREATE INDEX pokestops_survey_answer_question_idx ON pokestops_survey_answer (question_id);

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
-- events: wydarzenia organizacji i samorządu dla młodzieży; udział nagradzany unikalnym pokemonem
-- ============================================================================
CREATE TABLE events_event (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id     bigint       NOT NULL REFERENCES accounts_organization (id) ON DELETE RESTRICT,
    created_by_id       bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE RESTRICT,
    title               varchar(100) NOT NULL,
    description         text         NOT NULL DEFAULT '',
    address             varchar(200),
    location            geography(Point, 4326) NOT NULL,
    starts_at           timestamptz  NOT NULL,
    ends_at             timestamptz  NOT NULL,
    reward_character_id smallint     NOT NULL REFERENCES collection_character (id),   -- unikalny pokemon za udział (is_event_exclusive)
    capacity            integer,                                                       -- NULL = bez limitu miejsc
    age_min             smallint,
    age_max             smallint,
    status              event_status NOT NULL DEFAULT 'scheduled',
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT event_title_not_blank CHECK (char_length(btrim(title)) >= 3),
    CONSTRAINT event_ends_after_start CHECK (ends_at > starts_at),
    CONSTRAINT event_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT event_age_range CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)
);
CREATE INDEX events_event_location_idx ON events_event USING gist (location);
CREATE INDEX events_event_starts_idx ON events_event (starts_at) WHERE status = 'scheduled';
CREATE INDEX events_event_org_idx ON events_event (organization_id);

CREATE TABLE events_participation (                     -- zameldowanie na wydarzeniu (na miejscu, w czasie trwania) = udział
    event_id          bigint       NOT NULL REFERENCES events_event (id) ON DELETE CASCADE,
    user_id           bigint       NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    location          geography(Point, 4326) NOT NULL,     -- pozycja przy zameldowaniu (sprawdza serwer)
    distance_m        numeric(9, 1) NOT NULL CHECK (distance_m >= 0),
    reward_pokemon_id bigint       NOT NULL UNIQUE REFERENCES collection_pokemon (id) ON DELETE RESTRICT,   -- pokemon za udział (origin='event')
    checked_in_at     timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)                        -- jeden udział (i jedna nagroda) na użytkownika
);
CREATE INDEX events_participation_user_idx ON events_participation (user_id);

-- ============================================================================
-- game: przeciwnicy (szablony i typy do mnożnika w walce); zależy od accounts i collection, nie odwrotnie
-- ============================================================================
CREATE TABLE game_enemy_type (                          -- szablony, z których serwer losuje przeciwników
    id            smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          varchar(32)       NOT NULL UNIQUE,
    name          varchar(80)       NOT NULL,
    emoji         varchar(8)        NOT NULL,
    description   text              NOT NULL DEFAULT '',
    type_id       smallint          NOT NULL REFERENCES collection_type (id),   -- typ do mnożnika: pokemon tego samego typu bije 1.2x mocniej
    action_kind   enemy_action_kind NOT NULL DEFAULT 'checkin',   -- jak potwierdzamy obecność na miejscu, zanim można zaatakować
    action_label  varchar(200)      NOT NULL,
    min_level     smallint          NOT NULL DEFAULT 1,
    max_level     smallint          NOT NULL DEFAULT 5,
    base_power    integer           NOT NULL,            -- moc na poziomie 1
    power_growth  integer           NOT NULL DEFAULT 10, -- przyrost mocy na poziom
    base_xp       integer           NOT NULL,
    spawn_weight  smallint          NOT NULL DEFAULT 1,           -- waga losowania
    is_active     boolean           NOT NULL DEFAULT true,
    CONSTRAINT enemy_level_range CHECK (min_level >= 1 AND min_level <= max_level),
    CONSTRAINT enemy_xp_positive CHECK (base_xp > 0),
    CONSTRAINT enemy_power_positive CHECK (base_power > 0 AND power_growth > 0),
    CONSTRAINT enemy_weight_positive CHECK (spawn_weight > 0)
);

CREATE TABLE game_encounter_cell (                      -- kwadrat terenu (bok game.encounters.cell_size_m), wspólny dla graczy
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "row"         integer     NOT NULL,                   -- numer kwadratu w siatce (z szerokości geograficznej)
    col           integer     NOT NULL,                   -- numer kwadratu w rzędzie (z długości, liczonej dla środka rzędu)
    populated_at  timestamptz,                            -- ostatnie zasiedlenie (losowanie 0..max_per_cell przeciwników)
    refill_at     timestamptz,                            -- kiedy wyczyszczony kwadrat zasiedli się na nowo; NULL, gdy stoją w nim przeciwnicy
    CONSTRAINT game_encounter_cell_unique UNIQUE ("row", col)
);

CREATE TABLE game_encounter (                           -- konkretny przeciwnik na mapie
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cell_id       bigint           REFERENCES game_encounter_cell (id) ON DELETE CASCADE,   -- kwadrat, do którego należy przeciwnik
    enemy_type_id smallint         NOT NULL REFERENCES game_enemy_type (id),
    level         smallint         NOT NULL,
    power         integer          NOT NULL,                      -- migawka mocy (z enemy_type.base_power/power_growth i poziomu) w chwili wygenerowania
    xp_reward     integer          NOT NULL,                      -- migawka nagrody w chwili wygenerowania
    location      geography(Point, 4326) NOT NULL,
    status        encounter_status NOT NULL DEFAULT 'active',
    spawned_at    timestamptz      NOT NULL DEFAULT now(),
    expires_at    timestamptz      NOT NULL,
    defeated_by_id bigint          REFERENCES accounts_user (id) ON DELETE SET NULL,
    defeated_at   timestamptz,
    CONSTRAINT encounter_level_range   CHECK (level BETWEEN 1 AND 100),
    CONSTRAINT encounter_power_positive CHECK (power > 0),
    CONSTRAINT encounter_xp_positive   CHECK (xp_reward > 0),
    CONSTRAINT encounter_expires_after CHECK (expires_at > spawned_at),
    CONSTRAINT encounter_defeat_consistent CHECK (
        (status = 'defeated') = (defeated_at IS NOT NULL)
        AND (status <> 'defeated' OR defeated_by_id IS NOT NULL)
    )
);
CREATE INDEX game_encounter_active_location_idx ON game_encounter USING gist (location) WHERE status = 'active';
CREATE INDEX game_encounter_cell_idx ON game_encounter (cell_id) WHERE status = 'active';
CREATE INDEX game_encounter_active_expiry_idx ON game_encounter (expires_at) WHERE status = 'active';

-- Stawiany pokemon musi należeć do autora, być dostępny (nie już zastawiony) i mieć gatunek
-- zgodny z `character_id` pinezki (to, co widać na mapie, to faktycznie zostawiony pokemon).
CREATE FUNCTION pokestops_pokestop_stake_belongs_to_author() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_character_id smallint;
BEGIN
    IF NEW.staked_pokemon_id IS NOT NULL THEN
        SELECT character_id INTO v_character_id
          FROM collection_pokemon
         WHERE id = NEW.staked_pokemon_id AND user_id = NEW.author_id AND NOT is_staked;
        IF v_character_id IS NULL THEN
            RAISE EXCEPTION 'staked_pokemon_id % nie jest dostępnym pokemonem autora %', NEW.staked_pokemon_id, NEW.author_id;
        END IF;
        IF v_character_id <> NEW.character_id THEN
            RAISE EXCEPTION 'character_id pinezki musi zgadzać się z gatunkiem zostawionego pokemona (pokestop %)', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER pokestops_pokestop_stake_ownership
    BEFORE INSERT ON pokestops_pokestop
    FOR EACH ROW EXECUTE FUNCTION pokestops_pokestop_stake_belongs_to_author();

CREATE FUNCTION pokestops_pokestop_mark_staked() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.staked_pokemon_id IS NOT NULL THEN
        UPDATE collection_pokemon SET is_staked = true WHERE id = NEW.staked_pokemon_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER pokestops_pokestop_stake_mark
    AFTER INSERT ON pokestops_pokestop
    FOR EACH ROW EXECUTE FUNCTION pokestops_pokestop_mark_staked();

-- Głosujący może nagrodzić wyłącznie własnego pokemona.
CREATE FUNCTION pokestops_vote_pokemon_belongs_to_voter() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM collection_pokemon WHERE id = NEW.rewarded_pokemon_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'rewarded_pokemon_id % nie należy do użytkownika %', NEW.rewarded_pokemon_id, NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER pokestops_vote_pokemon_ownership
    BEFORE INSERT OR UPDATE OF rewarded_pokemon_id ON pokestops_vote
    FOR EACH ROW EXECUTE FUNCTION pokestops_vote_pokemon_belongs_to_voter();

-- Zwrot zastawionego pokemona. Decyzję (próg głosów, rozwiązanie, odrzucenie, wycofanie) i wysokość premii exp
-- podejmuje aplikacja w jednej transakcji i zapisuje w stake_released_at/stake_bonus_exp. Baza pilnuje tylko
-- niezmiennika: gdy zwrot zostaje zapisany, pokemon przestaje być "zastawiony".
CREATE FUNCTION pokestops_pokestop_sync_stake_flag() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE collection_pokemon SET is_staked = false WHERE id = NEW.staked_pokemon_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER pokestops_pokestop_stake_release
    AFTER UPDATE OF stake_released_at ON pokestops_pokestop
    FOR EACH ROW
    WHEN (OLD.stake_released_at IS NULL AND NEW.stake_released_at IS NOT NULL AND NEW.staked_pokemon_id IS NOT NULL)
    EXECUTE FUNCTION pokestops_pokestop_sync_stake_flag();

-- ============================================================================
-- game: walki i postęp gracza (logika gry i antyoszustwo po stronie serwera)
-- ============================================================================
CREATE TABLE game_attack (                              -- jedna próba walki z przeciwnikiem: dziennik + rozstrzygnięcie
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_id bigint         NOT NULL REFERENCES game_encounter (id) ON DELETE CASCADE,
    user_id      bigint         NOT NULL REFERENCES accounts_user (id) ON DELETE CASCADE,
    location     geography(Point, 4326) NOT NULL,              -- pozycja zgłoszona przez klienta
    distance_m   numeric(9, 1)  NOT NULL,                      -- odległość policzona przez serwer
    accuracy_m   numeric(8, 1),                                -- deklarowana dokładność GPS
    client_time  timestamptz,
    pokemon_power_total integer,                                -- suma (moc * mnożnik typu) wybranych pokemonów; NULL gdy outcome='too_far' (do walki nie doszło)
    reward_pokemon_id bigint UNIQUE REFERENCES collection_pokemon (id) ON DELETE RESTRICT,  -- nowy pokemon za wygraną (origin='encounter'); NULL przy innym wyniku
    outcome      attack_outcome NOT NULL,
    reason       text,
    created_at   timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT attack_distance_non_negative CHECK (distance_m >= 0),
    CONSTRAINT attack_power_total_required CHECK ((outcome IN ('won', 'lost')) = (pokemon_power_total IS NOT NULL)),
    CONSTRAINT attack_reward_iff_won       CHECK ((outcome = 'won') = (reward_pokemon_id IS NOT NULL))
);
-- Tylko jedno zwycięstwo na przeciwnika, nawet przy równoległych żądaniach.
CREATE UNIQUE INDEX game_attack_one_win_per_encounter ON game_attack (encounter_id) WHERE outcome = 'won';
CREATE INDEX game_attack_user_time_idx ON game_attack (user_id, created_at DESC);   -- limity częstotliwości

CREATE TABLE game_attack_pokemon (                      -- do 3 pokemonów użytych w jednej walce
    attack_id               bigint       NOT NULL REFERENCES game_attack (id) ON DELETE CASCADE,
    pokemon_id              bigint       NOT NULL REFERENCES collection_pokemon (id) ON DELETE RESTRICT,
    power_used              integer      NOT NULL,              -- moc pokemona w chwili walki (migawka, wzór mocy może się zmieniać)
    type_multiplier_applied numeric(3,2) NOT NULL DEFAULT 1.00,  -- 1.20, gdy typ pokemona = typ przeciwnika (patrz README)
    exp_gained              integer      NOT NULL DEFAULT 0,     -- exp dopisany po wygranej (wartość z aplikacji); 0 przy porażce
    PRIMARY KEY (attack_id, pokemon_id),
    CONSTRAINT attack_pokemon_power_positive    CHECK (power_used > 0),
    CONSTRAINT attack_pokemon_multiplier_valid  CHECK (type_multiplier_applied >= 1.00),
    CONSTRAINT attack_pokemon_exp_non_negative  CHECK (exp_gained >= 0)
);

-- Pokemon musi należeć do atakującego, być dostępny (nie zastawiony) i co najwyżej 3 na walkę.
CREATE FUNCTION game_attack_pokemon_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id       bigint;
    v_pokemon_count integer;
BEGIN
    SELECT user_id INTO v_user_id FROM game_attack WHERE id = NEW.attack_id;
    IF NOT EXISTS (
        SELECT 1 FROM collection_pokemon WHERE id = NEW.pokemon_id AND user_id = v_user_id AND NOT is_staked
    ) THEN
        RAISE EXCEPTION 'pokemon_id % nie jest dostępnym pokemonem gracza %', NEW.pokemon_id, v_user_id;
    END IF;
    SELECT count(*) INTO v_pokemon_count FROM game_attack_pokemon WHERE attack_id = NEW.attack_id;
    IF v_pokemon_count > 3 THEN
        RAISE EXCEPTION 'walka może użyć maksymalnie 3 pokemonów (attack_id %)', NEW.attack_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER game_attack_pokemon_check
    AFTER INSERT ON game_attack_pokemon
    FOR EACH ROW EXECUTE FUNCTION game_attack_pokemon_validate();

CREATE TABLE game_player_progress (
    user_id    bigint PRIMARY KEY REFERENCES accounts_user (id) ON DELETE CASCADE,
    xp         bigint      NOT NULL DEFAULT 0,             -- poziom wylicza aplikacja z xp (wzór może się zmieniać)
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT progress_xp_non_negative CHECK (xp >= 0)
);

-- ----------------------------------------------------------------------------
-- Triggery updated_at
-- ----------------------------------------------------------------------------
CREATE TRIGGER accounts_user_updated         BEFORE UPDATE ON accounts_user         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER accounts_organization_updated BEFORE UPDATE ON accounts_organization FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER scenarios_scenario_updated    BEFORE UPDATE ON scenarios_scenario    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pokestops_pokestop_updated    BEFORE UPDATE ON pokestops_pokestop    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER events_event_updated          BEFORE UPDATE ON events_event          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER collection_pokemon_updated    BEFORE UPDATE ON collection_pokemon    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER game_player_progress_updated  BEFORE UPDATE ON game_player_progress  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
