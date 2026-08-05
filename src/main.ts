import { MatchGame } from './game';
import { showLobby } from './lobby';
import { AudioManager } from './audio';
import { loadSettings, saveSettings, type Settings } from './settings';
import { defaultStats, recordMatchOnce, createWriteId, type PlayerStats } from './persistence';
import { showAd } from './ad';
import { fetchLeaderboard, loadLocalHistory, recordMatchResult } from './net/leaderboard';
import type { OnlineMatchGame } from './net/onlineGame';
import type { MatchClient } from './net/client';
import type { NakamaSocket } from './net/nakama';

const STATS_KEY = 'robot_arena_stats_v1';

/** Lazy-loaded online stack — kept out of the initial bundle (INV-3). */
async function loadOnlineStack() {
  const [{ OnlineMatchGame }, { MatchClient }, nakama] = await Promise.all([
    import('./net/onlineGame'),
    import('./net/client'),
    import('./net/nakama'),
  ]);
  return { OnlineMatchGame, MatchClient, nakama };
}

function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    const d = defaultStats();
    return {
      wins: typeof parsed.wins === 'number' ? parsed.wins : d.wins,
      kills: typeof parsed.kills === 'number' ? parsed.kills : d.kills,
      matches: typeof parsed.matches === 'number' ? parsed.matches : d.matches,
      xp: typeof parsed.xp === 'number' ? parsed.xp : d.xp,
      level: typeof parsed.level === 'number' ? parsed.level : d.level,
      damage: typeof parsed.damage === 'number' ? parsed.damage : d.damage,
    };
  } catch {
    return defaultStats();
  }
}

function saveStats(stats: PlayerStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore write failures
  }
}

function init() {
  const maybeCanvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!maybeCanvas) throw new Error('Canvas #game not found');
  const canvas: HTMLCanvasElement = maybeCanvas;

  let settings: Settings = loadSettings();
  let stats: PlayerStats = loadStats();
  const audio = new AudioManager();
  audio.setVolume(settings.volume);

  let game: MatchGame | null = null;
  let onlineGame: OnlineMatchGame | null = null;
  let onlineClient: MatchClient | null = null;
  let socket: NakamaSocket | null = null;
  let queueTicket: string | null = null;
  let queueActive = false;

  function launchMatch() {
    game?.dispose();
    audio.resume();
    game = new MatchGame({
      canvas,
      settings,
      audio,
      botCount: 9,
      callbacks: {
        onFinished(summary) {
          const levelBefore = stats.level;
          const writeId = createWriteId();
          const { stats: next } = recordMatchOnce(
            stats,
            writeId,
            summary.won,
            summary.kills,
            summary.damage,
            summary.xpGained
          );
          stats = next;
          saveStats(stats);
          if (stats.level > levelBefore) audio.play('levelup');
        },
        onLobby() {
          showAdThenLobby();
        },
        onPlayAgain() {
          showAdThenLaunch();
        },
      },
    });
    game.start();
  }

  async function ensureOnlineConnection(): Promise<NakamaSocket> {
    if (socket) return socket;
    const { nakama } = await loadOnlineStack();
    const session = nakama.getSession() ?? (await nakama.authenticateGuest());
    socket = await nakama.connectSocket(session);
    return socket;
  }

  async function resetQueue() {
    if (queueTicket && socket) {
      try {
        const { nakama } = await loadOnlineStack();
        await nakama.removeFromMatchmaker(socket, queueTicket);
      } catch {
        // ignore cancel failures
      }
    }
    queueTicket = null;
    queueActive = false;
  }

  async function cancelQueue() {
    await resetQueue();
    showLobbyUI();
  }

  async function launchOnlineMatch() {
    const { OnlineMatchGame: OnlineGame } = await loadOnlineStack();
    onlineGame?.dispose();
    audio.resume();
    onlineGame = new OnlineGame({
      canvas,
      settings,
      audio,
      client: onlineClient!,
      callbacks: {
        onFinished(summary) {
          const levelBefore = stats.level;
          const writeId = createWriteId();
          const xpGained =
            Math.max(10, (11 - summary.placement) * 10) +
            summary.kills * 25 +
            Math.round(summary.damage / 10);
          const { stats: next } = recordMatchOnce(
            stats,
            writeId,
            summary.won,
            summary.kills,
            summary.damage,
            xpGained
          );
          stats = next;
          saveStats(stats);
          void recordMatchResult({
            matchId: onlineClient?.matchIdString ?? `online_${writeId}`,
            placement: summary.placement,
            kills: summary.kills,
            damage: summary.damage,
            won: summary.won,
            mode: 'online',
          });
          if (stats.level > levelBefore) audio.play('levelup');
        },
        onLobby() {
          showAdThenLobby();
        },
      },
    });
    onlineGame.start();
  }

  async function joinOnlineMatch(matchId: string) {
    queueActive = false;
    await resetQueue();
    const { MatchClient: Client } = await loadOnlineStack();
    onlineClient = new Client('online', {
      onSnapshot: () => {},
      onDisconnect: () => {
        // INV-5: reconnection failure returns to lobby cleanly.
        showAdThenLobby();
      },
    });
    await onlineClient.connect();
    await onlineClient.joinExistingMatch(matchId);
    await launchOnlineMatch();
  }

  async function startOnlineQueue() {
    if (queueActive) return;
    queueActive = true;
    showLobbyUI();
    try {
      const { nakama } = await loadOnlineStack();
      const s = await ensureOnlineConnection();
      queueTicket = await nakama.addToMatchmaker(s);
      nakama.onSocketDisconnect(s, () => {
        queueActive = false;
        queueTicket = null;
        showAdThenLobby();
      });
      nakama.onMatchmakerMatched(s, (matchId) => {
        void joinOnlineMatch(matchId);
      });
    } catch {
      queueActive = false;
      queueTicket = null;
      // Nakama down → fall back to lobby with a clear status (still Play Local).
      showLobby(
        {
          level: stats.level,
          xp: stats.xp,
          wins: stats.wins,
          kills: stats.kills,
          matches: stats.matches,
        },
        settings,
        {
          onPlayLocal() {
            launchMatch();
          },
          onPlayOnline() {
            void startOnlineQueue();
          },
          onCancelQueue() {
            void cancelQueue();
          },
          onSettingsChange(changes) {
            settings = { ...settings, ...changes };
            saveSettings(settings);
            applyQuality(settings.quality);
            audio.setVolume(settings.volume);
          },
        },
        { history: loadLocalHistory(), leaderboard: [] },
        { active: false, message: 'Online unavailable — try Play Local' }
      );
    }
  }

  async function showAdThenLobby() {
    game?.dispose();
    game = null;
    onlineGame?.dispose();
    onlineGame = null;
    onlineClient?.dispose();
    onlineClient = null;
    await resetQueue();
    await showAd({ skipAfterMs: 5000, online: false }); // Local: 5s skip
    showLobbyUI();
  }

  async function showAdThenLaunch() {
    await showAd({ skipAfterMs: 5000, online: false }); // Local: 5s skip
    launchMatch();
  }

  function applyQuality(quality: 'low' | 'medium') {
    document.documentElement.dataset.quality = quality;
  }

  async function showLobbyUI() {
    const [history, leaderboard] = await Promise.all([loadLocalHistory(), fetchLeaderboard()]);
    showLobby(
      {
        level: stats.level,
        xp: stats.xp,
        wins: stats.wins,
        kills: stats.kills,
        matches: stats.matches,
      },
      settings,
      {
        onPlayLocal() {
          launchMatch();
        },
        onPlayOnline() {
          void startOnlineQueue();
        },
        onCancelQueue() {
          void cancelQueue();
        },
        onSettingsChange(changes) {
          settings = { ...settings, ...changes };
          saveSettings(settings);
          applyQuality(settings.quality);
          audio.setVolume(settings.volume);
        },
      },
      { history, leaderboard },
      { active: queueActive, message: 'Searching for match...' }
    );
  }

  applyQuality(settings.quality);
  showLobbyUI();
}

init();
