import { useCallback, useRef, useState } from 'react';

const DEFAULT_VOLUME = 0.3;
const TRACKS = ['/bgm_new.mp3', '/bgm.mp3'];

export function useBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = useRef(0);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const loadTrack = useCallback((index: number) => {
    const audio = audioRef.current!;
    trackIndexRef.current = index;
    audio.src = TRACKS[index];
    audio.load();
  }, []);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.volume = volumeRef.current;
      audio.onplay = () => setPlaying(true);
      audio.onpause = () => setPlaying(false);
      audio.onerror = (e) => console.warn('[BGM] error:', e);
      audio.onended = () => {
        // When current track ends, play the next one
        const next = (trackIndexRef.current + 1) % TRACKS.length;
        loadTrack(next);
        audio.play();
      };
      audioRef.current = audio;
      loadTrack(0);
    }
    return audioRef.current;
  }, [loadTrack]);

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
