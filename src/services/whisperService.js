import { getSettings } from '../store/settingsStore';
import { getServerUrl } from '../store/documentStore';

class WhisperService {
  constructor() {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.recordingStartTime = 0;
    this.state = {
      isRecording: false,
      isTranscribing: false,
      duration: 0,
      error: null,
      lastTranscription: ''
    };
    this.listeners = new Set();
    this.timerInterval = null;
    this.recordingSource = 'global';
  }

  getAudioStream() {
    return this.audioStream;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[WhisperService] Fejl i lytter:', err);
      }
    }
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  async startRecording(source = 'global') {
    if (this.state.isRecording || this.state.isTranscribing) {
      return;
    }

    this.recordingSource = source;

    try {
      this.setState({ error: null, duration: 0 });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioStream = stream;
      this.audioChunks = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      }

      const options = mimeType ? { mimeType } : undefined;
      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.audioStream) {
          this.audioStream.getTracks().forEach(track => track.stop());
          this.audioStream = null;
        }
      };

      this.mediaRecorder.start(200);
      this.recordingStartTime = Date.now();

      this.setState({ isRecording: true, isTranscribing: false, error: null });

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.state.isRecording) {
          const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
          this.setState({ duration });
        }
      }, 500);

      window.dispatchEvent(new CustomEvent('speech:recording-started'));
    } catch (err) {
      console.error('[WhisperService] Kunne ikke starte optagelse:', err);
      let errMsg = 'Kunne ikke få adgang til mikrofonen.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Mikrofonadgang blev afvist. Giv tilladelse til mikrofonen.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'Ingen mikrofon fundet på computeren.';
      }
      this.setState({ isRecording: false, isTranscribing: false, error: errMsg });
      window.dispatchEvent(new CustomEvent('speech:error', { detail: { message: errMsg } }));
    }
  }

  async stopRecording() {
    if (!this.state.isRecording || !this.mediaRecorder) {
      return;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        if (this.audioStream) {
          this.audioStream.getTracks().forEach(track => track.stop());
          this.audioStream = null;
        }

        if (this.audioChunks.length === 0 || (Date.now() - this.recordingStartTime) < 200) {
          this.audioChunks = [];
          this.setState({ isRecording: false, isTranscribing: false, duration: 0 });
          resolve({ success: false, error: 'Optagelsen var for kort' });
          return;
        }

        this.setState({ isRecording: false, isTranscribing: true });
        window.dispatchEvent(new CustomEvent('speech:transcribing-started'));

        try {
          const blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
          this.audioChunks = [];

          const result = await this.sendAudioToWhisper(blob);

          if (result.success && result.text) {
            this.setState({
              isTranscribing: false,
              lastTranscription: result.text,
              error: null
            });

            window.dispatchEvent(new CustomEvent('speech:transcription-complete', {
              detail: { text: result.text, source: this.recordingSource || 'global' }
            }));

            resolve(result);
          } else {
            const errorMsg = result.error || 'Intet svar fra Whisper serveren';
            this.setState({ isTranscribing: false, error: errorMsg });
            window.dispatchEvent(new CustomEvent('speech:error', { detail: { message: errorMsg } }));
            resolve({ success: false, error: errorMsg });
          }
        } catch (err) {
          console.error('[WhisperService] Transskriptionsfejl:', err);
          const errorMsg = err.message || 'Ukendt fejl under transskription';
          this.setState({ isTranscribing: false, error: errorMsg });
          window.dispatchEvent(new CustomEvent('speech:error', { detail: { message: errorMsg } }));
          resolve({ success: false, error: errorMsg });
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.setState({ isRecording: false, isTranscribing: false });
        resolve({ success: false, error: e.message });
      }
    });
  }
  cancelRecording() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaRecorder && this.state.isRecording) {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {}
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.audioChunks = [];
    this.recordingSource = 'global';
    this.setState({ isRecording: false, isTranscribing: false, duration: 0 });
    window.dispatchEvent(new CustomEvent('speech:recording-cancelled'));
  }

  toggleRecording(source = 'global') {
    if (this.state.isRecording) {
      return this.stopRecording();
    } else if (!this.state.isTranscribing) {
      return this.startRecording(source);
    }
  }

  async convertBlobToWav(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return { buffer: arrayBuffer, mimeType: blob.type || 'audio/webm' };
      }

      const audioCtx = new AudioContextClass();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      const targetSampleRate = 16000;
      const numChannels = 1;
      const length = Math.ceil(decodedBuffer.duration * targetSampleRate);
      
      const offlineCtx = new OfflineAudioContext(numChannels, length, targetSampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const resampledBuffer = await offlineCtx.startRendering();
      await audioCtx.close();

      const channelData = resampledBuffer.getChannelData(0);
      const wavBuffer = this.encodeWav(channelData, targetSampleRate);
      return { buffer: wavBuffer, mimeType: 'audio/wav' };
    } catch (err) {
      console.warn('[WhisperService] WAV-konvertering fejlede, bruger rå blob i stedet:', err.message);
      const rawBuf = await blob.arrayBuffer();
      return { buffer: rawBuf, mimeType: blob.type || 'audio/webm' };
    }
  }

  encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }

  async sendAudioToWhisper(audioBlob) {
    const serverUrl = getServerUrl().replace(/\/+$/, '');

    // Konverter lyd til 16kHz mono WAV i RAM
    const { buffer, mimeType } = await this.convertBlobToWav(audioBlob);

    // Konverter ArrayBuffer til base64 i hukommelsen
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 16384;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
    }
    const audioBase64 = btoa(binary);

    try {
      const response = await fetch(`${serverUrl}/api/ai/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: mimeType || 'audio/wav'
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMsg = errData.error || `Server svarede med status ${response.status}`;
        return { success: false, error: errorMsg };
      }

      const data = await response.json();
      return { success: true, text: (data.text || '').trim() };
    } catch (err) {
      console.error('[WhisperService] Fejl under afsendelse til server:', err);
      let msg = err.message || 'Kunne ikke forbinde til Server-PC';
      if (err.name === 'TimeoutError') {
        msg = 'Tidsudløb: Server-PC tog for lang tid om at transskribere';
      } else if (err.message && err.message.includes('Failed to fetch')) {
        msg = `Kunne ikke forbinde til Server-PC på ${serverUrl}. Sørg for at MitEgetWord serveren kører.`;
      }
      return { success: false, error: msg };
    }
  }

}

export const whisperService = new WhisperService();

