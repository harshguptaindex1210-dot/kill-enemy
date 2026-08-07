import { MatchGame } from './game';
import { AudioManager } from './audio';
import { loadSettings, saveSettings, type Settings } from './settings';
import {
  defaultStats,
  recordMatchOnce,
  createWriteId,
  type PlayerStats,
} from './persistence';
import { showAd } from './ad';
import { fetchLeaderboard, loadLocalHistory, recordMatchResult } from './net/leaderboard';
import {
  buyCarSkin,
  buyChassis,
  buyGunSkin,
  equipCarSkin,
  equipChassis,
  equipGunSkin,
  grantMatchCredits,
  loadProfile,
  matchCreditsReward,
  mergeProfiles,
  saveProfile,
  setProfileName,
  syncLevelUnlocks,
  addFriend,
  removeFriend,
  type PlayerProfile,
} from './profile';
import { carColorFor, chassisById, gunColorFor } from './cosmetics';
import type { ChassisId } from './cosmetics';
import type { LobbySceneHandle } from './lobbyScene';
import type { SimEvent } from './gameplay';
import type { OnlineMatchGame } from './net/onlineGame';
import type { MatchClient } from './net/client';
import type { NakamaSocket } from './net/nakama';
import {
  allowDemoOnlineFallback,
  canSyncWithNakama,
  onlineUnavailableMessage,
} from './net/nakamaConfig';
import { isPhoneDevice } from './platform';

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

function matchCosmetics(profile: PlayerProfile) {
  const chassis = chassisById(profile.chassisId);
  return {
    chassisColor: chassis?.color ?? 0x3366cc,
    chassisId: profile.chassisId,
    rifleColor: gunColorFor('rifle', profile.equippedRifleSkin),
    pistolColor: gunColorFor('pistol', profile.equippedPistolSkin),
    sedanColor: carColorFor('sedan', profile.equippedSedanSkin),
    buggyColor: carColorFor('buggy', profile.equippedBuggySkin),
    displayName: profile.name,
  };
}

function init() {
  const maybeCanvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!maybeCanvas) throw new Error('Canvas #game not found');
  const canvas: HTMLCanvasElement = maybeCanvas;

  let settings: Settings = loadSettings();
  const urlQuality = new URLSearchParams(location.search).get('quality');
  if (urlQuality === 'low' || urlQuality === 'medium' || urlQuality === 'high') {
    settings = { ...settings, quality: urlQuality };
  }
  let stats: PlayerStats = loadStats();
  let profile: PlayerProfile = syncLevelUnlocks(loadProfile(), stats.level);
  saveProfile(profile);
  let shopMessage = '';
  const audio = new AudioManager();
  audio.setVolume(settings.volume);

  let game: MatchGame | null = null;
  let onlineGame: OnlineMatchGame | null = null;
  let onlineClient: MatchClient | null = null;
  let socket: NakamaSocket | null = null;
  let queueTicket: string | null = null;
  let queueActive = false;
  let lobbyScene: LobbySceneHandle | null = null;
  const onlineEventBridge = { sink: null as ((events: SimEvent[]) => void) | null };

  function lobbyCosmetics() {
    const chassis = chassisById(profile.chassisId);
    return {
      chassisColor: chassis?.color ?? 0x3366cc,
      rifleColor: gunColorFor('rifle', profile.equippedRifleSkin),
      pistolColor: gunColorFor('pistol', profile.equippedPistolSkin),
    };
  }

  function stopLobbyScene() {
    lobbyScene?.dispose();
    lobbyScene = null;
  }

  async function startLobbyScene() {
    try {
      const { createLobbyScene } = await import('./lobbyScene');
      stopLobbyScene();
      lobbyScene = createLobbyScene(canvas, settings.quality, lobbyCosmetics());
      lobbyScene.start();
    } catch (err) {
      console.warn('Lobby 3D backdrop unavailable:', err);
    }
  }

  async function syncProfileOnline() {
    if (!canSyncWithNakama()) return;
    try {
      const { nakama } = await loadOnlineStack();
      const session = nakama.getSession() ?? (await nakama.authenticateGuest());
      const remote = await nakama.loadProfileFromServer(session.user_id!);
      if (remote) {
        profile = syncLevelUnlocks(mergeProfiles(profile, remote), stats.level);
        saveProfile(profile);
      }
    } catch {
      // offline — local profile only
    }
  }

  async function pushProfileOnline() {
    if (!canSyncWithNakama()) return;
    try {
      const { nakama } = await loadOnlineStack();
      const session = nakama.getSession();
      if (!session?.user_id) return;
      await nakama.saveProfileToServer(session.user_id, profile, createWriteId());
    } catch {
      // ignore
    }
  }

  function persistProfile(next: PlayerProfile) {
    profile = next;
    profile = syncLevelUnlocks(profile, stats.level);
    saveProfile(profile);
    lobbyScene?.setCosmetics(lobbyCosmetics());
    void pushProfileOnline();
  }

  function afterMatchRewards(summary: {
    won: boolean;
    kills: number;
    damage: number;
    xpGained: number;
  }) {
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
    const credits = matchCreditsReward();
    persistProfile(grantMatchCredits(profile, credits));
    shopMessage = `+${credits} credits`;
    if (stats.level > levelBefore) audio.play('levelup');
  }

  function launchMatch() {
    stopLobbyScene();
    game?.dispose();
    audio.resume();
    game = new MatchGame({
      canvas,
      settings,
      audio,
      botCount: 9,
      cosmetics: matchCosmetics(profile),
      callbacks: {
        onFinished(summary) {
          afterMatchRewards(summary);
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
    stopLobbyScene();
    onlineGame?.dispose();
    audio.resume();
    const overlay = document.getElementById('lobby-overlay');
    if (overlay) overlay.remove();
    onlineGame = new OnlineGame({
      canvas,
      settings,
      audio,
      client: onlineClient!,
      callbacks: {
        onFinished(summary) {
          const xpGained =
            Math.max(10, (11 - summary.placement) * 10) +
            summary.kills * 25 +
            Math.round(summary.damage / 10);
          afterMatchRewards({
            won: summary.won,
            kills: summary.kills,
            damage: summary.damage,
            xpGained,
          });
          void recordMatchResult({
            matchId: onlineClient?.matchIdString ?? `online_${createWriteId()}`,
            placement: summary.placement,
            kills: summary.kills,
            damage: summary.damage,
            won: summary.won,
            mode: 'online',
          });
        },
        onLobby() {
          showAdThenLobby();
        },
      },
    });
    onlineEventBridge.sink = (events) => onlineGame!.handleEvents(events);
    onlineGame.start();
  }

  async function joinOnlineMatch(matchId: string) {
    queueActive = false;
    await resetQueue();
    const { MatchClient: Client } = await loadOnlineStack();
    onlineClient = new Client('online', {
      onSnapshot: () => {},
      onDisconnect: () => {
        showAdThenLobby();
      },
      onEvents: (events) => onlineEventBridge.sink?.(events),
    });
    await onlineClient.connect();
    await onlineClient.joinExistingMatch(matchId);
    await launchOnlineMatch();
  }

  async function launchDemoOnlineMatch() {
    const { MatchClient: Client } = await loadOnlineStack();
    onlineClient = new Client('local', {
      onSnapshot: () => {},
      onDisconnect: () => {
        showAdThenLobby();
      },
      onEvents: (events) => onlineEventBridge.sink?.(events),
    });
    await onlineClient.connect();
    await onlineClient.startMatch();
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
    } catch (err) {
      queueActive = false;
      queueTicket = null;
      if (allowDemoOnlineFallback()) {
        await launchDemoOnlineMatch();
        return;
      }
      showLobbyUI(onlineUnavailableMessage(err));
    }
  }

  async function showAdThenLobby() {
    game?.dispose();
    game = null;
    onlineGame?.dispose();
    onlineGame = null;
    onlineEventBridge.sink = null;
    onlineClient?.dispose();
    onlineClient = null;
    await resetQueue();
    await showAd({ skipAfterMs: 5000, online: false });
    showLobbyUI();
  }

  async function showAdThenLaunch() {
    await showAd({ skipAfterMs: 5000, online: false });
    launchMatch();
  }

  function applyQuality(quality: 'low' | 'medium' | 'high') {
    document.documentElement.dataset.quality = quality;
  }

  function lobbyCallbacks() {
    return {
      onPlayLocal() {
        if (queueActive) return;
        shopMessage = '';
        launchMatch();
      },
      onPlayOnline() {
        void startOnlineQueue();
      },
      onCancelQueue() {
        void cancelQueue();
      },
      onSettingsChange(changes: Partial<Settings>) {
        settings = { ...settings, ...changes };
        saveSettings(settings);
        applyQuality(settings.quality);
        audio.setVolume(settings.volume);
      },
      onProfileChange(next: PlayerProfile) {
        persistProfile(next);
        showLobbyUI();
      },
      onRename(name: string) {
        const result = setProfileName(profile, name);
        if ('error' in result) {
          shopMessage = result.error;
        } else {
          persistProfile(result.profile);
          shopMessage = 'Name saved';
        }
        showLobbyUI();
      },
      onEquipChassis(id: string) {
        const next = equipChassis(profile, id as ChassisId);
        if (next) {
          persistProfile(next);
          shopMessage = 'Chassis equipped';
        } else shopMessage = 'Chassis not owned';
        showLobbyUI();
      },
      onEquipGunSkin(skinId: string) {
        const next = equipGunSkin(profile, skinId);
        if (next) {
          persistProfile(next);
          shopMessage = 'Skin equipped';
        } else shopMessage = 'Skin not owned';
        showLobbyUI();
      },
      onBuyGunSkin(skinId: string) {
        const result = buyGunSkin(profile, skinId, stats.level);
        if ('error' in result) shopMessage = result.error;
        else {
          persistProfile(result.profile);
          shopMessage = 'Skin purchased';
        }
        showLobbyUI();
      },
      onBuyChassis(chassisId: string) {
        const result = buyChassis(profile, chassisId as ChassisId, stats.level);
        if ('error' in result) shopMessage = result.error;
        else {
          persistProfile(result.profile);
          shopMessage = 'Chassis purchased';
        }
        showLobbyUI();
      },
      onEquipCarSkin(skinId: string) {
        const next = equipCarSkin(profile, skinId);
        if (next) {
          persistProfile(next);
          shopMessage = 'Car skin equipped';
        } else shopMessage = 'Car skin not owned';
        showLobbyUI();
      },
      onBuyCarSkin(skinId: string) {
        const result = buyCarSkin(profile, skinId, stats.level);
        if ('error' in result) shopMessage = result.error;
        else {
          persistProfile(result.profile);
          shopMessage = 'Car skin purchased';
        }
        showLobbyUI();
      },
      onAddFriend(username: string) {
        const result = addFriend(profile, username);
        if ('error' in result) shopMessage = result.error;
        else {
          persistProfile(result.profile);
          shopMessage = `Added ${result.profile.friends[result.profile.friends.length - 1]}`;
        }
        showLobbyUI();
      },
      onRemoveFriend(username: string) {
        persistProfile(removeFriend(profile, username));
        shopMessage = `Removed ${username}`;
        showLobbyUI();
      },
      onInviteFriend(username: string) {
        shopMessage = `Invite sent to ${username} (online matchmaking stub)`;
        showLobbyUI();
      },
    };
  }

  async function showLobbyUI(forcedQueueMessage?: string) {
    await syncProfileOnline();
    const [{ showLobby }, history, leaderboard] = await Promise.all([
      import('./lobby'),
      loadLocalHistory(),
      fetchLeaderboard(),
    ]);
    showLobby(
      {
        level: stats.level,
        xp: stats.xp,
        wins: stats.wins,
        kills: stats.kills,
        matches: stats.matches,
      },
      settings,
      profile,
      lobbyCallbacks(),
      { history, leaderboard },
      {
        active: queueActive,
        message: forcedQueueMessage ?? (queueActive ? 'Searching for match...' : ''),
      },
      shopMessage
    );
    void startLobbyScene();
  }

  applyQuality(settings.quality);
  void showLobbyUI();
}

function showBootError(message?: string) {
  const el = document.getElementById('boot-error');
  if (!el) return;
  if (message) {
    const p = el.querySelector('p');
    if (p) p.textContent = message;
  }
  el.classList.add('visible');
}

async function boot() {
  if (isPhoneDevice()) {
    const [{ initPhoneLandscapeMode }] = await Promise.all([
      import('./orientation'),
      import('./orientation.css'),
    ]);
    initPhoneLandscapeMode();
  }
  init();
}

boot().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error('Kill Enemy failed to start:', err);
  showBootError(
    detail.includes('WebGL')
      ? 'WebGL is unavailable on this device. Try closing other tabs or updating iOS Safari.'
      : 'The game failed to start. Try refreshing the page.'
  );
});
