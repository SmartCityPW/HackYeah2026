import { ModerationPage, ModerationQuery } from '../moderation.model';

/**
 * Log moderacji AI dla administratora. Tryb źródła danych jak dla pinezek (`api.mode.pokestops`).
 *   list   GET /admin/moderation-log?verdict=&since=&pageSize=
 */
export abstract class ModerationApi {
  abstract list(query: ModerationQuery): Promise<ModerationPage>;
}
