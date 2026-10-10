import {SpriteActor} from './sprite-actor.mjs';

// Silent inspection harness. This is not an episode / story / default character.
// Export contract is the same .frame + __player.set / total as render_episode.mjs.
try {
  const response = await fetch('./config.json');
  if (!response.ok) throw new Error('Missing config.json');
  const config = await response.json();
  if (!(config.durationMs > config.portraitMs && config.portraitMs > 0)) throw new Error('Invalid preview duration');
  const actor = await new SpriteActor(config.actor).load();
  const canvas = document.getElementById('stage');
  const context = canvas.getContext('2d', {alpha: false});
  const params = new URLSearchParams(location.search);
  let ms = Math.max(0, Math.min(config.durationMs - 1, Number(params.get('t')) || 0));
  let playing = false, startTime = 0, startMs = 0;
  const seek = document.getElementById('seek');
  seek.max = config.durationMs - 1;
  if (params.get('rec') === '1') document.body.classList.add('rec');
  function fit() {
    document.querySelector('.frame').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  }
  fit(); addEventListener('resize', fit);
  function set(time) {
    ms = Math.max(0, Math.min(config.durationMs - 1, time));
    const portrait = ms < config.portraitMs;
    const frames = portrait ? config.portraitFrames : config.miniFrames;
    if (!Array.isArray(frames) || !frames.length) throw new Error('Configure the inspected frame list explicitly');
    const local = portrait ? ms : ms - config.portraitMs;
    const segment = portrait ? config.portraitMs : config.durationMs - config.portraitMs;
    const frame = frames[Math.min(frames.length - 1, Math.floor(local / segment * frames.length))];
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#0b151a'; context.fillRect(0, 0, 1920, 1080);
    context.fillStyle = '#34494a'; context.fillRect(250, 850, 1420, 8);
    context.fillStyle = '#d5d9c9'; context.font = '32px monospace'; context.textAlign = 'center';
    context.fillText(`${portrait ? '2×2 半身表情' : '4×4 小人动作'} · ${String(frame).padStart(2, '0')}`, 960, 110);
    if (portrait) actor.portrait(context, {x: 960, waist: 850, scale: 1.4, frame});
    else actor.mini(context, {x: 960, foot: 850, scale: 1.2, frame});
    seek.value = ms; document.getElementById('time').textContent = `${(ms / 1000).toFixed(2)} s`;
  }
  window.__player = {set, get: () => ms, total: config.durationMs,
    sprites: actor.groups.mini.images.length, busts: actor.groups.portrait.images.length};
  set(ms); document.querySelector('.loading').remove();
  function pause() {playing = false; document.getElementById('play').textContent = '▶';}
  function play() {if (ms >= config.durationMs - 1) set(0); startTime = performance.now(); startMs = ms; playing = true; document.getElementById('play').textContent = 'Ⅱ';}
  document.getElementById('play').onclick = () => playing ? pause() : play();
  seek.oninput = () => {pause(); set(Number(seek.value));};
  function tick(now) {
    if (playing) {set(startMs + now - startTime); if (ms >= config.durationMs - 1) pause();}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
} catch (error) {
  document.querySelector('.loading').textContent = error.message;
  window.__renderError = error.message;
  throw error;
}
