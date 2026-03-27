import { useCallback, useRef, useState } from 'react';

const DEFAULT_VOLUME = 0.2;

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio('/bgm_new.mp3');
      audio.loop = true;
      audio.volume = volumeRef.current;
      audio.onplay = () => setPlaying(true);
      audio.onpause = () => setPlaying(false);
      audio.onerror = (e) => console.warn('[BGM] error:', e);
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const start = useCallback(() => {
    const audio = getAudio();
    if (audio.paused) audio.play();
  }, [getAudio]);

  const toggle = useCallback(() => {
    const audio = getAudio();
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [getAudio]);

  const changeVolume = useCallback((v: number) => {
    volumeRef.current = v;
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  return { playing, volume, toggle, start, changeVolume };
}
