import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Um link de menu da navbar. Único lugar que sabe como um item de menu se parece. */
@Component({
  selector: 'app-nav-item',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-item.component.html',
  styleUrl: './nav-item.component.scss',
})
export class NavItemComponent {
  readonly path = input.required<string>();
  readonly label = input.required<string>();
}
