import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../../core/navigation';
import { Icon } from '../icon/icon';

/** Dolny pasek nawigacji (na szerokich ekranach: pionowy pasek po lewej). */
@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  readonly items = input.required<NavItem[]>();
}
