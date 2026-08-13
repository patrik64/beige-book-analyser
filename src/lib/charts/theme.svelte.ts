import { DARK, LIGHT, type Palette } from './palette';

/**
 * Tracks the effective colour scheme so canvas charts can be rebuilt when it flips.
 * Charts can't use CSS custom properties, so they read the palette through here.
 */
class Theme {
	/** 'light' | 'dark' | 'system' — what the user chose. */
	preference = $state<'light' | 'dark' | 'system'>('system');
	/** What that resolves to right now. */
	resolved = $state<'light' | 'dark'>('light');

	get palette(): Palette {
		return this.resolved === 'dark' ? DARK : LIGHT;
	}

	/** Called once from the root layout, in the browser only. */
	init() {
		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') this.preference = stored;

		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const apply = () => {
			this.resolved =
				this.preference === 'system' ? (query.matches ? 'dark' : 'light') : this.preference;
			document.documentElement.dataset.theme = this.resolved;
		};
		apply();
		query.addEventListener('change', apply);
		return () => query.removeEventListener('change', apply);
	}

	set(preference: 'light' | 'dark' | 'system') {
		this.preference = preference;
		if (preference === 'system') localStorage.removeItem('theme');
		else localStorage.setItem('theme', preference);

		this.resolved =
			preference === 'system'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: preference;
		document.documentElement.dataset.theme = this.resolved;
	}

	toggle() {
		this.set(this.resolved === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new Theme();
