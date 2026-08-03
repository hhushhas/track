import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import type { UploadableFile } from '@/lib/attachment-upload';
import { hapticDestructive, hapticLight, hapticMedium } from '@/lib/haptics';

/**
 * Camera frames are re-encoded by the picker before they reach us. Dropping
 * quality is the only downscale available today; capping the longest edge to
 * `MaxImageEdge` additionally needs `expo-image-manipulator`, which is not a
 * dependency of this app yet.
 */
export const MaxImageEdge = 1600;
const CameraQuality = 0.6;
const LibraryQuality = 0.7;
const SelectionLimit = 10;

let sequence = 0;

function nextId() {
  sequence += 1;
  return `attachment-${Date.now()}-${sequence}`;
}

function explainDenied(subject: string) {
  Alert.alert(
    `Track cannot reach your ${subject}`,
    `Allow ${subject} access in Settings to attach it to this conversation.`,
    [
      { style: 'cancel', text: 'Not now' },
      { onPress: () => void Linking.openSettings(), text: 'Open settings' },
    ],
  );
}

function assetToFile(asset: ImagePicker.ImagePickerAsset): UploadableFile {
  const contentType = asset.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1] ?? 'jpg';
  return {
    contentType,
    filename: asset.fileName ?? `photo-${Date.now()}.${extension}`,
    id: nextId(),
    kind: 'file',
    size: asset.fileSize,
    uri: asset.uri,
  };
}

export async function capturePhoto(): Promise<UploadableFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    explainDenied('camera');
    return [];
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: CameraQuality,
  });
  if (result.canceled) return [];
  return result.assets.map(assetToFile);
}

export async function pickImages(): Promise<UploadableFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    explainDenied('photo library');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images'],
    quality: LibraryQuality,
    selectionLimit: SelectionLimit,
  });
  if (result.canceled) return [];
  return result.assets.map(assetToFile);
}

export async function pickDocuments(): Promise<UploadableFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    contentType: asset.mimeType ?? 'application/octet-stream',
    filename: asset.name,
    id: nextId(),
    kind: 'file' as const,
    size: asset.size ?? undefined,
    uri: asset.uri,
  }));
}

function voiceNoteFile(input: { durationMs: number; uri: string }): UploadableFile {
  return {
    contentType: 'audio/mp4',
    durationMs: input.durationMs,
    filename: `voice-note-${Date.now()}.m4a`,
    id: nextId(),
    kind: 'voice_note',
    uri: input.uri,
  };
}

/** Maps an expo-audio metering reading (dBFS) onto a 0–1 display level. */
function meteringLevel(metering: number | undefined) {
  if (metering === undefined) return 0.2;
  const floor = -60;
  return Math.min(1, Math.max(0, (metering - floor) / -floor));
}

const VoicePreset = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const MinRecordingMs = 700;

export type VoiceRecorderMode = 'idle' | 'recording' | 'locked';

/**
 * Push-to-talk state machine for the composer microphone. `start` may still be
 * awaiting the permission prompt when the finger lifts, so the release is
 * tracked on a ref and replayed once recording has actually begun.
 */
export function useVoiceRecorder(handlers: {
  onCapture: (file: UploadableFile) => void;
  onNotice: (message: string) => void;
}) {
  const recorder = useAudioRecorder(VoicePreset);
  const state = useAudioRecorderState(recorder, 120);
  const [mode, setMode] = useState<VoiceRecorderMode>('idle');
  const modeRef = useRef<VoiceRecorderMode>('idle');
  const durationRef = useRef(0);
  const hold = useRef({ aborted: false, holding: false });
  const level = useSharedValue(0.2);

  useEffect(() => {
    durationRef.current = state.durationMillis;
    level.value = withTiming(meteringLevel(state.metering), { duration: 110 });
  }, [level, state.durationMillis, state.metering]);

  function switchMode(next: VoiceRecorderMode) {
    modeRef.current = next;
    setMode(next);
  }

  async function stopRecorder() {
    try {
      await recorder.stop();
    } catch {
      /* the recorder was already released */
    }
  }

  async function finish() {
    if (modeRef.current === 'idle') return;
    switchMode('idle');
    const durationMs = durationRef.current;
    await stopRecorder();
    const uri = recorder.uri;
    if (!uri || durationMs < MinRecordingMs) {
      handlers.onNotice('Hold the microphone to record a voice note.');
      return;
    }
    handlers.onCapture(voiceNoteFile({ durationMs, uri }));
  }

  async function start(locked: boolean) {
    if (modeRef.current !== 'idle') return;
    hold.current = { aborted: false, holding: !locked };
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      handlers.onNotice('Microphone access is off. Enable it in Settings to record a voice note.');
      return;
    }
    if (hold.current.aborted) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
    hapticMedium();
    switchMode(locked ? 'locked' : 'recording');
    if (!locked && !hold.current.holding) void finish();
  }

  function lock() {
    if (modeRef.current !== 'recording') return;
    hapticLight();
    switchMode('locked');
  }

  async function cancel() {
    hold.current.aborted = true;
    if (modeRef.current === 'idle') return;
    hapticDestructive();
    switchMode('idle');
    await stopRecorder();
    handlers.onNotice('Voice note discarded.');
  }

  /** Called when the hold gesture ends; `outcome` is 0 unless already resolved. */
  function release(outcome: number) {
    hold.current.holding = false;
    if (outcome !== 0 || modeRef.current !== 'recording') return;
    void finish();
  }

  return { cancel, durationMs: state.durationMillis, finish, level, lock, mode, release, start };
}
