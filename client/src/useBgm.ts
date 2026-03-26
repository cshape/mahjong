import { useCallback, useRef, useState } from 'react';

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    // Lazily create on first user interaction (avoids autoplay policy issues)
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.src = '/bgm.mp4';
      audio.loop = true;
      audio.volume = 0.3;
      audio.preload = 'auto';
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  return { playing, toggle };
}
