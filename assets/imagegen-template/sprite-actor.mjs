// Asset adapter only. All identity, face, hair and clothing pixels come from PNGs.
// No built-in figure, generated nose, source-video pixels or missing-image fallback.

async function fetchManifest(path, expectedCount, kind) {
  const url = new URL(path, document.baseURI);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Missing ${kind} manifest: ${url.pathname} (${response.status})`);
  const manifest = await response.json();
  const frames = Array.isArray(manifest.frames) ? manifest.frames : manifest.framesMeta;
  const count = Array.isArray(frames) ? frames.length : Number(manifest.frames);
  if (count !== expectedCount) throw new Error(`${kind} requires ${expectedCount} registered frames; found ${count}`);
  const [width, height] = manifest.canvas || [];
  const baseline = manifest.baseline ?? manifest.footBaseline ?? manifest.waistBaseline;
  const anchor = manifest.anchor || [width / 2, baseline];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      !anchor.every(Number.isFinite) || anchor[1] <= 0 || anchor[1] >= height) {
    throw new Error(`${kind} manifest needs canvas dimensions and an in-canvas feet/waist baseline`);
  }
  const images = await Promise.all(Array.from({length: count}, (_, i) => new Promise((resolve, reject) => {
    const frame = frames?.[i];
    if (frame && frame.frame !== undefined && frame.frame !== i) {
      reject(new Error(`${kind} frame order must be row-major: expected ${i}`)); return;
    }
    const image = new Image();
    const imageURL = new URL(frame?.file || `${String(i).padStart(2, '0')}.png`, url);
    image.onload = () => {
      if (image.naturalWidth !== width || image.naturalHeight !== height) {
        reject(new Error(`${imageURL.pathname}: PNG does not match manifest canvas ${width}x${height}`));
      } else resolve(image);
    };
    image.onerror = () => reject(new Error(`Missing ${kind} asset: ${imageURL.pathname}. Register the generated transparent atlas first.`));
    image.src = imageURL.href;
  })));
  return {manifest, images, width, height, anchor};
}

export class SpriteActor {
  constructor({mini, portrait}) {
    if (!mini || !portrait) throw new Error('SpriteActor requires explicit mini and portrait manifest paths');
    this.paths = {mini, portrait};
    this.groups = null;
  }

  async load() {
    const [mini, portrait] = await Promise.all([
      fetchManifest(this.paths.mini, 16, 'mini'),
      fetchManifest(this.paths.portrait, 4, 'portrait'),
    ]);
    this.groups = {mini, portrait};
    return this;
  }

  draw(context, {kind = 'mini', frame = 0, x, baseline, scale = 1, flipX = false}) {
    if (!this.groups) throw new Error('Await SpriteActor.load() before drawing or exposing __player');
    const group = this.groups[kind];
    if (!group) throw new Error(`Unknown actor kind: ${kind}`);
    if (!Number.isInteger(frame) || frame < 0 || frame >= group.images.length) {
      throw new Error(`${kind} frame ${frame} is outside the registered sheet`);
    }
    if (![x, baseline, scale].every(Number.isFinite) || scale <= 0) {
      throw new Error('Actor x, baseline and positive scale must be finite numbers');
    }
    context.save();
    context.imageSmoothingEnabled = false;
    context.translate(Math.round(x), Math.round(baseline));
    if (flipX) context.scale(-1, 1);
    context.drawImage(group.images[frame],
      Math.round(-group.anchor[0] * scale), Math.round(-group.anchor[1] * scale),
      Math.round(group.width * scale), Math.round(group.height * scale));
    context.restore();
  }

  mini(context, {foot, ...options}) {
    this.draw(context, {...options, kind: 'mini', baseline: foot});
  }

  portrait(context, {waist, ...options}) {
    this.draw(context, {...options, kind: 'portrait', baseline: waist});
  }
}
