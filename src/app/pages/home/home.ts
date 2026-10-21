import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addRecentHandle, clearRecentHandles, getRecentHandles } from '../../core/recent';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly router = inject(Router);

  readonly handle = signal('');
  readonly recent = signal(getRecentHandles());
  readonly error = signal('');

  submit(): void {
    const clean = this.handle().trim();
    if (!clean) {
      this.error.set('Enter a Codeforces handle first.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(clean)) {
      this.error.set('That does not look like a Codeforces handle.');
      return;
    }
    this.error.set('');
    this.recent.set(addRecentHandle(clean));
    void this.router.navigate(['/u', clean]);
  }

  useHandle(handle: string): void {
    this.handle.set(handle);
    this.submit();
  }

  clearRecent(): void {
    clearRecentHandles();
    this.recent.set([]);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector<HTMLInputElement>('.search-input')?.focus();
  }
}
