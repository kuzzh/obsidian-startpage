import { requestUrl } from "obsidian";

export interface VersionInfo {
	hasUpdate: boolean;
	latestVersion: string;
	currentVersion: string;
	releaseUrl: string;
}

export class VersionChecker {
	private static readonly GITHUB_API_URL = "https://api.github.com/repos/kuzzh/obsidian-startpage/releases/latest";
	private static readonly GITHUB_RELEASE_URL = "https://github.com/kuzzh/obsidian-startpage/releases";
	
	/**
	 * Check if there's a new version available
	 * @param currentVersion Current plugin version
	 * @returns Version information
	 */
	static async checkForUpdate(currentVersion: string): Promise<VersionInfo | null> {
		try {
			const response = await requestUrl({
				url: this.GITHUB_API_URL,
				method: "GET",
				headers: {
					"Accept": "application/vnd.github.v3+json"
				}
			});

			if (response.status !== 200) {
				console.warn("Failed to check for updates:", response.status);
				return null;
			}

			const latestRelease = response.json;
			const latestVersion = latestRelease.tag_name?.replace(/^v/, "") || latestRelease.name?.replace(/^v/, "");

			if (!latestVersion) {
				console.warn("Could not determine latest version");
				return null;
			}

			const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

			return {
				hasUpdate,
				latestVersion,
				currentVersion,
				releaseUrl: this.GITHUB_RELEASE_URL
			};
		} catch (error) {
			console.error("Error checking for updates:", error);
			return null;
		}
	}

	/**
	 * Compare two version strings
	 * @param v1 Version 1
	 * @param v2 Version 2
	 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
	 */
	private static compareVersions(v1: string, v2: string): number {
		const parts1 = v1.split(".").map(Number);
		const parts2 = v2.split(".").map(Number);

		for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
			const part1 = parts1[i] || 0;
			const part2 = parts2[i] || 0;

			if (part1 > part2) return 1;
			if (part1 < part2) return -1;
		}

		return 0;
	}
}
