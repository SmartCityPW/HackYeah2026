import { Component, OnInit, inject, signal } from '@angular/core';
import { formatDateTime } from '../../../core/date.utils';
import { describeError } from '../../../core/http/api-error';
import { ModerationEntry, ModerationVerdict, VERDICT_META } from '../../../core/moderation.model';
import { ModerationService } from '../../../core/moderation.service';
import { ToastService } from '../../../core/toast.service';

interface Filter {
  id: string;
  label: string;
  verdicts: ModerationVerdict[];
}

/**
 * Co moderacja AI odrzuciła. Odrzucone zgłoszenie nie powstaje jako pinezka, więc to jedyne miejsce, w którym administrator o nim wie.
 * Tylko informacja: zgłoszeń nie przywracamy (autor może zgłosić poprawioną treść ponownie).
 */
@Component({
  selector: 'app-ai-rejections',
  templateUrl: './ai-rejections.html',
  styleUrl: './ai-rejections.css',
})
export class AiRejections implements OnInit {
  protected readonly moderation = inject(ModerationService);
  private readonly toast = inject(ToastService);

  protected readonly filters: Filter[] = [
    { id: 'rejected', label: 'Odrzucone', verdicts: ['rejected'] },
    { id: 'error', label: 'Agent niedostępny', verdicts: ['error'] },
    { id: 'approved', label: 'Zatwierdzone', verdicts: ['approved'] },
  ];
  protected readonly filter = signal<Filter>(this.filters[0]);
  protected readonly meta = VERDICT_META;
  protected readonly format = formatDateTime;
  protected readonly loaded = signal(false);

  ngOnInit(): void {
    void this.load(this.filters[0]);
  }

  protected async load(filter: Filter): Promise<void> {
    this.filter.set(filter);
    try {
      await this.moderation.load(filter.verdicts);
      this.loaded.set(true);
      // Odrzucenia obejrzane: odznaka gaśnie, a wpisy nowsze od poprzedniej wizyty zostają oznaczone "nowe".
      if (filter.id === 'rejected') this.moderation.markSeen();
    } catch (error) {
      this.toast.show(describeError(error), '⚠️');
    }
  }

  protected isNew(entry: ModerationEntry): boolean {
    const seen = this.moderation.seenBeforeOpen();
    return entry.verdict === 'rejected' && (seen === null || entry.createdAt > seen);
  }

  protected detailRows(entry: ModerationEntry): { key: string; value: string }[] {
    return Object.entries(entry.submitted.details ?? {}).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(', ') : String(value) }));
  }
}
