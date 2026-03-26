import { useCallback, useRef, useState } from 'react';

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio('/bgm.mp3');
      audio.loop = true;
      audio.volume = 0.3;
      audio.onplay = () => setPlaying(true);
      audio.onpause = () => setPlaying(false);
      audio.onerror = (e) => console.warn('[BGM] error:', e);
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    if (audio.paused) {
      // play() returns a promise — must be called from user gesture
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  return { playing, toggle };
}
