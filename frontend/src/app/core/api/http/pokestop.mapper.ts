import { Me } from '../account.api';
import { Pokemon } from '../../pokemon.model';
import { CharacterId, NewReport, Pokestop, PokestopComment, VoteResult } from '../../pokestop.model';
import { CommentDto, MeDto, NewPokestopDto, PokemonDto, PokestopDto, VoteResultDto } from './contract.types';

/**
 * Odpowiedź backendu -> model frontendu. Jedyne miejsce, które zna oba kształty:
 * zmiany w kontrakcie poprawiamy tutaj, a nie w komponentach.
 *
 * Uwaga: lista pinezek nie zawiera komentarzy (tylko `commentCount`), więc `comments` jest puste,
 * a pełna dyskusja przychodzi z GET /pokestops/{id}/comments (patrz PokestopService.loadComments).
 */
export function toPokestop(dto: PokestopDto): Pokestop {
  return {
    id: dto.id,
    type: dto.type,
    character: dto.character as CharacterId,
    status: dto.status,
    scenarioId: dto.scenarioCode,
    icon: dto.icon,
    title: dto.title,
    description: dto.description ?? '',
    author: dto.author,
    mine: dto.mine,
    organization: dto.organization ?? undefined,
    photos: dto.photos?.map((p) => p.url) ?? [],
    details: dto.details ?? {},
    comments: [],
    commentCount: dto.commentCount,
    lat: dto.lat,
    lng: dto.lng,
    votesFor: dto.votesFor,
    votesAgainst: dto.votesAgainst,
    myVote: dto.myVote,
  };
}

export function toPokemon(dto: PokemonDto): Pokemon {
  return {
    id: dto.id,
    character: dto.character as CharacterId,
    nickname: dto.nickname,
    level: dto.level,
    exp: dto.exp,
    power: dto.power,
    isStaked: dto.isStaked,
  };
}

export function toVoteResult(dto: VoteResultDto): VoteResult {
  return { stop: toPokestop(dto.stop), pokemon: toPokemon(dto.pokemon) };
}

export function toComment(dto: CommentDto): PokestopComment {
  return {
    id: dto.id,
    parentId: dto.parentCommentId ?? null,
    author: dto.author,
    text: dto.text,
    mine: dto.mine,
    replies: dto.replies?.map(toComment) ?? [],
  };
}

/**
 * Model frontendu -> ciało POST /pokestops. Serwer ustala autora, status i rodzaj pinezki,
 * a dla `report`/`idea` także postać (z gatunku zastawionego pokemona), więc jej wtedy nie wysyłamy.
 * Zdjęcia nie są jeszcze wysyłane (POST /photos po stronie backendu zwraca 501).
 */
export function toNewPokestop(report: NewReport): NewPokestopDto {
  const staked = report.type === 'report' || report.type === 'idea';
  return {
    scenarioCode: report.scenarioId,
    title: report.title,
    description: report.description,
    ...(staked ? { stakedPokemonId: report.stakedPokemonId } : { character: report.character }),
    lat: report.lat,
    lng: report.lng,
    details: report.details,
  };
}

export function toMe(dto: MeDto): Me {
  return { id: dto.id, displayName: dto.displayName, role: dto.role, isGuest: dto.isGuest, organization: dto.organization };
}
