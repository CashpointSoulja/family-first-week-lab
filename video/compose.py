"""Compose recorded frames + caption band + narration into a 1080x1920 MP4, and write the SRT."""
import json, os, subprocess, bisect
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'out')
tl = json.load(open(os.path.join(out, 'timeline.json')))
W, H, BAND, FPS = 1080, 1920, 170, 30

font_ttf = os.path.join(out, 'Epilogue-500.ttf')
if not os.path.exists(font_ttf):
    f = TTFont(os.path.join(here, '..', 'node_modules/@fontsource/epilogue/files/epilogue-latin-500-normal.woff'))
    f.flavor = None
    f.save(font_ttf)
font = ImageFont.truetype(font_ttf, 42)

frames = tl['frames']
times = [f['t'] for f in frames]
phrases = tl['phrases']
starts = [p['start'] for p in phrases]
dur = min(tl['end'], phrases[-1]['start'] + phrases[-1]['dur'] + 0.35)

cap_cache = {}
def band(idx):
    if idx in cap_cache: return cap_cache[idx]
    img = Image.new('RGB', (W, BAND), (250, 247, 242))
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (W, 0)], fill=(217, 222, 225), width=2)
    if idx is not None:
        lines = phrases[idx]['cap'].split('\n')
        lh = 54
        y = (BAND - lh * len(lines)) // 2 + 4
        for ln in lines:
            w = d.textlength(ln, font=font)
            assert w < W - 60, f'caption line too wide: {ln}'
            d.text(((W - w) / 2, y), ln, font=font, fill=(30, 48, 58))
            y += lh
    cap_cache[idx] = img
    return img

enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', os.path.join(out, 'video-only.mp4')], stdin=subprocess.PIPE)
last_file, last_img = None, None
n = int(dur * FPS)
for k in range(n):
    t = k / FPS
    fi = max(0, bisect.bisect_right(times, t) - 1)
    pi = bisect.bisect_right(starts, t) - 1
    cap = pi if pi >= 0 and t <= phrases[pi]['start'] + phrases[pi]['dur'] + 0.25 else (pi if pi >= 0 else None)
    file = frames[fi]['file']
    if file != last_file:
        canvas = Image.new('RGB', (W, H), (250, 247, 242))
        canvas.paste(Image.open(os.path.join(out, 'frames', file)).convert('RGB').resize((W, H - BAND)), (0, 0))
        last_file, last_img = file, canvas
    frame = last_img.copy()
    frame.paste(band(cap), (0, H - BAND))
    enc.stdin.write(frame.tobytes())
enc.stdin.close(); enc.wait()

# Narration: each phrase WAV placed at its logged start.
inputs, filt = [], []
for i, p in enumerate(phrases):
    inputs += ['-i', os.path.join(out, 'vo', f"{p['scene']}-{p['i']}.wav")]
    filt.append(f"[{i}]adelay={int(p['start'] * 1000)}:all=1[a{i}]")
filt.append(''.join(f'[a{i}]' for i in range(len(phrases))) + f'amix=inputs={len(phrases)}:normalize=0,apad,atrim=0:{n / FPS:.3f}[mix]')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[mix]', '-ar', '48000', os.path.join(out, 'narration.wav')], check=True)
final = os.path.join(out, 'family-first-week-lab-walkthrough.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(out, 'video-only.mp4'), '-i', os.path.join(out, 'narration.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-map_metadata', '-1', '-metadata', 'title=Family First-Week Lab walkthrough (independent concept by Ayo Ahmed)', final], check=True)

def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f'{int(h):02}:{int(m):02}:{int(s):02},{int(round((s % 1) * 1000)):03}'
with open(os.path.join(here, 'walkthrough.srt'), 'w') as f:
    for i, p in enumerate(phrases):
        f.write(f"{i + 1}\n{ts(p['start'])} --> {ts(p['start'] + p['dur'])}\n{p['cap']}\n\n")
with open(os.path.join(here, 'NARRATION.md'), 'w') as f:
    f.write('# Narration script (timed)\n\nFirst-person script, spoken by a synthetic British voice generated locally. Times are from the recording log.\n\n| Start | Scene | Spoken | Caption |\n|---|---|---|---|\n')
    for p in phrases:
        f.write(f"| {p['start']:.1f}s | {p['scene']} | {p['say']} | {p['cap'].replace(chr(10), ' / ')} |\n")
print('wrote', final, f'{n / FPS:.1f}s')
