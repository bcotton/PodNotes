import { get, writable } from 'svelte/store';
import type PodNotes from 'src/main';
import { Episode } from 'src/types/Episode';
import { PlayedEpisode } from 'src/types/PlayedEpisode';
import { PodcastFeed } from 'src/types/PodcastFeed';
import { Playlist } from 'src/types/Playlist';
import { ViewState } from 'src/types/ViewState';
import DownloadedEpisode from 'src/types/DownloadedEpisode';
import { TFile } from 'obsidian';

export const plugin = writable<PodNotes>();
export const currentTime = writable<number>(0);
export const duration = writable<number>(0);

export const currentEpisode = function () {
	const store = writable<Episode>();
	const { subscribe, update } = store;

	return {
		subscribe,
		update,
		set: (newEpisode: Episode, addPrevToQueue = true) => {
			update(previousEpisode => {
				if (previousEpisode) {
					if (addPrevToQueue) {
						addEpisodeToQueue(previousEpisode);
					}

					const ct = get(currentTime);
					const dur = get(duration);
					const isFinished = ct === dur;
					playedEpisodes.setEpisodeTime(previousEpisode, ct, dur, isFinished);
				}

				return newEpisode;
			});
		}
	}
}();

export const isPaused = writable<boolean>(true);
export const playedEpisodes = function () {
	const store = writable<{ [key: string]: PlayedEpisode }>({});
	const { subscribe, update, set } = store;

	return {
		subscribe,
		set,
		update,
		setEpisodeTime: (episode: Episode, time: number, duration: number, finished: boolean) => {
			update(playedEpisodes => {
				playedEpisodes[episode.title] = {
					title: episode.title,
					podcastName: episode.podcastName,
					time,
					duration,
					finished,
				};

				return playedEpisodes;
			});
		},
		markAsPlayed: (episode: Episode) => {
			update(playedEpisodes => {
				const playedEpisode = playedEpisodes[episode.title];

				if (playedEpisode) {
					playedEpisode.time = playedEpisode.duration;
					playedEpisode.finished = true;
				}

				playedEpisodes[episode.title] = playedEpisode;
				return playedEpisodes;
			});
		},
		markAsUnplayed: (episode: Episode) => {
			update(playedEpisodes => {
				const playedEpisode = playedEpisodes[episode.title];

				if (playedEpisode) {
					playedEpisode.time = 0;
					playedEpisode.finished = false;
				}

				playedEpisodes[episode.title] = playedEpisode;
				return playedEpisodes;
			});
		}
	}
}();

export const savedFeeds = writable<{ [podcastName: string]: PodcastFeed }>({});

export const episodeCache = writable<{ [podcastName: string]: Episode[] }>({});

export const downloadedEpisodes = function () { 
	const store = writable<{ [podcastName: string]: DownloadedEpisode[] }>({});
	const { subscribe, update, set } = store;

	function isEpisodeDownloaded(episode: Episode): boolean {
		return get(store)[episode.podcastName]?.some(e => e.title === episode.title);
	}

	return {
		subscribe,
		set,
		update,
		isEpisodeDownloaded,
		addEpisode: (episode: Episode, filePath: string, size: number) => {
			update(downloadedEpisodes => {
				const podcastEpisodes = downloadedEpisodes[episode.podcastName] || [];

				podcastEpisodes.push({
					...episode,
					filePath,
					size
				});

				downloadedEpisodes[episode.podcastName] = podcastEpisodes;
				return downloadedEpisodes;
			});
		},
		removeEpisode: (episode: Episode, removeFile: boolean) => {
			update(downloadedEpisodes => {
				const podcastEpisodes = downloadedEpisodes[episode.podcastName] || [];
				const index = podcastEpisodes.findIndex(e => e.title === episode.title)
				const filePath = podcastEpisodes[index].filePath;

				podcastEpisodes.splice(index, 1);

				if (removeFile) {
					try {
						const file = app.vault.getAbstractFileByPath(filePath);

						if ((file instanceof TFile)) {
							app.vault.delete(file);
						}
					} catch (error) {
						console.error(error);
					}
				}
					
				downloadedEpisodes[episode.podcastName] = podcastEpisodes;
				return downloadedEpisodes;
			});
		},
		getEpisode: (episode: Episode) => {
			return get(store)[episode.podcastName]?.find(e => e.title === episode.title);
		}
	}
}();

export const queue = function () {
	const store = writable<Playlist>({
		icon: 'list-ordered',
		name: 'Queue',
		episodes: [],
		shouldEpisodeRemoveAfterPlay: true,
		shouldRepeat: false,
	});
	const { subscribe, update, set } = store;

	return {
		subscribe,
		update,
		set,
		add: (episode: Episode) => {
			update(queue => {
				queue.episodes.push(episode);
				return queue;
			});
		},
		remove: (episode: Episode) => {
			update(queue => {
				queue.episodes = queue.episodes.filter(e => e.title !== episode.title);
				return queue;
			});
		},
		playNext: () => {
			update(queue => {
				const nextEp = queue.episodes.shift();

				if (nextEp) {
					currentEpisode.set(nextEp, false);
				}

				return queue;
			});
		}
	}
}();

export const favorites = writable<Playlist>({
	icon: 'lucide-star',
	name: 'Favorites',
	episodes: [],
	shouldEpisodeRemoveAfterPlay: false,
	shouldRepeat: false,
});

export const localFiles = writable<Playlist>({
	icon: 'folder',
	name: 'Local Files',
	episodes: [],
	shouldEpisodeRemoveAfterPlay: false,
	shouldRepeat: false,
});

export const playlists = writable<{ [name: string]: Playlist }>({});

export const podcastView = writable<HTMLDivElement>();
export const viewState = function () {
	const store = writable<ViewState>(ViewState.PodcastGrid);
	const { subscribe, set } = store;

	return {
		subscribe,
		set: (newState: ViewState) => {
			set(newState);
			
			get(podcastView)?.scrollIntoView();
		}
	}
 }();

function addEpisodeToQueue(episode: Episode) {
	queue.update(playlist => {
		const newEpisodes = [episode, ...playlist.episodes];
		playlist.episodes = newEpisodes;

		return playlist;
	});
}
