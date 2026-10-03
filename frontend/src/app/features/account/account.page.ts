import { Component } from '@angular/core';
import { AccountPanel } from '../../shared/account/account-panel';

/** Ekran "Konto" mieszkańca i administratora (organizacja ma konto w zakładce "Organizacja"). */
@Component({
  selector: 'app-account-page',
  imports: [AccountPanel],
  template: `<div class="page"><h1>Konto</h1><app-account-panel /></div>`,
})
export class AccountPage {}
