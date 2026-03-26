import { useCallback, useRef, useState } from 'react';

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = document.createElement('audio');
      audio.src = '/bgm.mp3';
      audio.loop = true;
      audio.volume = 0.3;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const toggle = useCallback(() => {
    const audio = getAudio();
    if (audio.paused) {
      // If not ready yet, wait for enough data then play
      const doPlay = () => {
        audio.play()
          .then(() => setPlaying(true))
          .catch((err) => console.warn('[BGM] play failed:', err));
      };
      if (audio.readyState >= 3) {
        doPlay();
      } else {
        audio.addEventListener('canplaythrough', doPlay, { once: true });
        audio.load();
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [getAudio]);

  return { playing, toggle };
}
