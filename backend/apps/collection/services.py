"""Reguły kolekcji pokemonów: poziom i moc liczone z exp (wzór z konfiguracji), przyznawanie pokemonów."""
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db.models import F

from apps.collection.models import Character, Pokemon, PokemonOrigin


def level_for(exp: int) -> int:
    return 1 + exp // settings.APP.game.levels.exp_per_pokemon_level


def power_for(character: Character, exp: int) -> int:
    return character.base_power + character.power_growth * (level_for(exp) - 1)


def grant_pokemon(user, character: Character, origin: str) -> Pokemon:
    return Pokemon.objects.create(user=user, character=character, origin=origin)


def grant_starter(user) -> Pokemon:
    character = Character.objects.filter(is_starter=True, is_active=True).first()
    if character is None:
        raise ImproperlyConfigured('Brak postaci startowej w słowniku (uruchom seed_reference)')
    return grant_pokemon(user, character, PokemonOrigin.STARTER)


def add_exp(pokemon: Pokemon, amount: int) -> None:
    """Dopisuje exp atomowo i odświeża obiekt."""
    Pokemon.objects.filter(pk=pokemon.pk).update(exp=F('exp') + amount)
    pokemon.refresh_from_db()
