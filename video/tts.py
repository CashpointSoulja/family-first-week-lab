"""Generate one narration WAV per phrase with Piper (free, local) and trim silence."""
import json, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
voice = os.environ.get('PIPER_VOICE') or sys.exit('Set PIPER_VOICE to an en_GB Piper .onnx voice')
out = os.path.join(here, 'out', 'vo'); os.makedirs(out, exist_ok=True)
script = json.load(open(os.path.join(here, 'script.json')))
durs = {}
for s in script['scenes']:
    for i, p in enumerate(s['phrases']):
        key = f"{s['id']}-{i}"
        raw, wav = os.path.join(out, key + '.raw.wav'), os.path.join(out, key + '.wav')
        subprocess.run([sys.executable, '-m', 'piper', '-m', voice, '--length-scale', '1.0', '-f', raw], input=p['say'].encode(), check=True, capture_output=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af',
            'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.12',
            '-ar', '48000', '-ac', '1', wav], check=True)
        os.remove(raw)
        d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).decode())
        durs[key] = round(d, 3)
json.dump(durs, open(os.path.join(out, 'durations.json'), 'w'), indent=1)
print(f'{len(durs)} phrases, {sum(durs.values()):.1f}s of narration')
