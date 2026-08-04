import { MatchGame } from './game';
import { showLobby } from './lobby';
import { AudioManager } from './audio';
import { loadSettings, saveSettings, type Settings } from './settings';
import { defaultStats, recordMatchOnce, createWriteId, type PlayerStats } from './persistence';

const STATS_KEY = 'robot_arena_stats_v1';

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
          game?.dispose();
          game = null;
          showLobbyUI();
        },
        onPlayAgain() {
          launchMatch();
        },
      },
    });
    game.start();
  }

  function applyQuality(quality: 'low' | 'medium') {
    document.documentElement.dataset.quality = quality;
  }

  function showLobbyUI() {
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
        onStartMatch() {
          launchMatch();
        },
        onSettingsChange(changes) {
          settings = { ...settings, ...changes };
          saveSettings(settings);
          applyQuality(settings.quality);
          audio.setVolume(settings.volume);
        },
      }
    );
  }

  applyQuality(settings.quality);
  showLobbyUI();
}

init();
