function audioContextConstructor() {
  return globalThis.AudioContext ?? globalThis.webkitAudioContext;
}

function disconnect(node) {
  try {
    node.disconnect();
  } catch {
    // Nodes may already have been disconnected by their scheduled cleanup.
  }
}

export function createIntroAudio() {
  let context = null;
  let enabled = false;
  let destroyed = false;
  let lastChargeStep = -1;
  const nodes = new Set();

  const clearNode = (node) => {
    nodes.delete(node);
    disconnect(node);
  };

  const stopNodes = () => {
    for (const node of nodes) {
      if (typeof node.stop === "function") {
        try {
          node.stop();
        } catch {
          // A stopped one-shot source cannot be stopped twice.
        }
      }
      disconnect(node);
    }
    nodes.clear();
  };

  const ensureContext = () => {
    if (context || destroyed) return context;
    const AudioContext = audioContextConstructor();
    if (!AudioContext) return null;
    context = new AudioContext();
    return context;
  };

  const resume = () => {
    if (context?.state === "suspended") void context.resume().catch(() => {});
  };

  const playTone = ({ frequency, endFrequency = frequency, duration, gain, type = "sine" }) => {
    if (!enabled || !context) return;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    nodes.add(oscillator);
    nodes.add(envelope);
    oscillator.onended = () => {
      clearNode(oscillator);
      clearNode(envelope);
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  };

  const playNoise = () => {
    if (!enabled || !context) return;
    const duration = 0.18;
    const start = context.currentTime;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    const envelope = context.createGain();
    source.buffer = buffer;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.09, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(envelope);
    envelope.connect(context.destination);
    nodes.add(source);
    nodes.add(envelope);
    source.onended = () => {
      clearNode(source);
      clearNode(envelope);
    };
    source.start(start);
    source.stop(start + duration + 0.02);
  };

  return {
    setEnabled(value) {
      if (destroyed) return;
      enabled = Boolean(value);
      if (!enabled) {
        stopNodes();
        if (context?.state === "running") void context.suspend().catch(() => {});
        return;
      }
      ensureContext();
      resume();
    },

    getEnabled() {
      return enabled;
    },

    charge(value) {
      if (!enabled || !context) return;
      const normalized = Math.min(Math.max(Number(value) || 0, 0), 1);
      const step = Math.floor(normalized * 8);
      if (step <= lastChargeStep) return;
      lastChargeStep = step;
      playTone({ frequency: 220 + step * 38, duration: 0.055, gain: 0.025, type: "triangle" });
    },

    ignite() {
      if (!enabled || !context) return;
      playNoise();
      playTone({ frequency: 110, endFrequency: 880, duration: 0.34, gain: 0.08, type: "sawtooth" });
      playTone({ frequency: 330, endFrequency: 1320, duration: 0.28, gain: 0.045 });
    },

    resolve() {
      if (!enabled || !context) return;
      playTone({ frequency: 392, endFrequency: 784, duration: 0.22, gain: 0.035 });
      lastChargeStep = -1;
    },

    destroy() {
      if (destroyed) return undefined;
      destroyed = true;
      enabled = false;
      stopNodes();
      const closingContext = context;
      context = null;
      return closingContext?.close();
    },
  };
}
