export default class Debounce {
	private timers: Map<string, number> = new Map();

	/**
	 * Debounce a function call
	 * @param key Unique identifier for this debounce operation
	 * @param func Function to debounce
	 * @param delay Delay in milliseconds
	 */
	public debounce(key: string, func: () => void, delay: number): void {
		// Clear existing timer for this key if exists
		const existingTimer = this.timers.get(key);
		if (existingTimer) {
			window.clearTimeout(existingTimer);
		}

		// Set new timer
		const timer = window.setTimeout(() => {
			func();
			this.timers.delete(key);
		}, delay);

		this.timers.set(key, timer);
	}

	/**
	 * Cancel a pending debounce operation
	 * @param key Unique identifier for the debounce operation to cancel
	 */
	public cancel(key: string): void {
		const timer = this.timers.get(key);
		if (timer) {
			window.clearTimeout(timer);
			this.timers.delete(key);
		}
	}

	/**
	 * Cancel all pending debounce operations
	 */
	public cancelAll(): void {
		for (const timer of this.timers.values()) {
			window.clearTimeout(timer);
		}
		this.timers.clear();
	}
}