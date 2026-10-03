import { CharacterId, Pokestop } from '../../pokestop.model';
import { PokestopDto } from './contract.types';

/**
 * Odpowiedź backendu -> model frontendu. Jedyne miejsce, które zna oba kształty:
 * zmiany w kontrakcie poprawiamy tutaj, a nie w komponentach.
 *
 * Uwaga: lista pinezek nie zawiera komentarzy (tylko `commentCount`), więc `comments` jest puste,
 * a pełna dyskusja przychodzi z GET /pokestops/{id}/comments (patrz docs/frontend-adaptation.md).
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
