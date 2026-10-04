// Shared "speak instead of typing" widget for CLRWF description/message
// fields (quote.html, commercial.html, contact.html). Two things happen
// at once from one mic tap: the Web Speech API live-transcribes into the
// textarea, and MediaRecorder independently captures the real audio --
// both get kept. The transcript is just for reading on a screen; the
// actual recording is what lets staff listen instead of read while
// driving, which is the point of this feature per the site owner.
//
// Degrades gracefully: if getUserMedia/MediaRecorder aren't available at
// all, the mic button never renders (falls back to plain typing). If only
// speech recognition is unavailable (no engine on this browser/OS), audio
// recording still works fine on its own -- the textarea just isn't
// auto-filled, which is still strictly better than nothing for someone
// who'd rather talk than type.
window.ClrwfVoiceInput = (function () {
  function mediaSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
  function speechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function attach(textareaId, mountId) {
    var textarea = document.getElementById(textareaId);
    var mount = document.getElementById(mountId);
    if (!textarea || !mount) return null;
    if (!mediaSupported()) { mount.style.display = 'none'; return null; }

    var state = {
      recording: false, blob: null, mimeType: null, mediaRecorder: null, chunks: [],
      recognition: null, baseText: '', finalTranscript: '', seconds: 0, timer: null, stream: null,
    };

    mount.innerHTML =
      '<button type="button" class="voice-btn" id="' + textareaId + '-voice-btn">' +
        '<i class="fas fa-microphone"></i><span>Speak Instead of Typing</span>' +
      '</button>' +
      '<span class="voice-status" id="' + textareaId + '-voice-status"></span>';

    var btn = document.getElementById(textareaId + '-voice-btn');
    var statusEl = document.getElementById(textareaId + '-voice-status');

    function fmtTime(totalSeconds) {
      var m = Math.floor(totalSeconds / 60), s = totalSeconds % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function setButtonState(recording) {
      btn.classList.toggle('recording', recording);
      btn.querySelector('span').textContent = recording ? 'Stop Recording' : (state.blob ? 'Re-record' : 'Speak Instead of Typing');
      btn.querySelector('i').className = recording ? 'fas fa-stop' : 'fas fa-microphone';
    }

    async function start() {
      statusEl.textContent = '';
      try {
        state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        statusEl.textContent = 'Microphone access denied — you can still type.';
        return;
      }

      state.chunks = [];
      var preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].filter(function (t) {
        return window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t);
      })[0];
      state.mimeType = preferredType || '';
      state.mediaRecorder = preferredType ? new MediaRecorder(state.stream, { mimeType: preferredType }) : new MediaRecorder(state.stream);
      state.mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) state.chunks.push(e.data); };
      state.mediaRecorder.onstop = function () {
        state.blob = new Blob(state.chunks, { type: state.mimeType || 'audio/webm' });
        state.stream.getTracks().forEach(function (t) { t.stop(); });
        // stop() below flips the icon/recording class synchronously, but
        // mediaRecorder.stop() only *requests* a stop -- this event (and
        // therefore state.blob) lands asynchronously after that, so the
        // "Re-record" label has to be set here, not in stop() itself, or
        // it reads state.blob before it exists and never shows it.
        setButtonState(false);
      };
      state.mediaRecorder.start();

      state.baseText = textarea.value ? (textarea.value.replace(/\s+$/, '') + ' ') : '';
      state.finalTranscript = '';

      if (speechSupported()) {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SR();
        state.recognition.continuous = true;
        state.recognition.interimResults = true;
        state.recognition.lang = 'en-US';
        state.recognition.onresult = function (event) {
          var interim = '';
          for (var i = event.resultIndex; i < event.results.length; i++) {
            var t = event.results[i][0].transcript;
            if (event.results[i].isFinal) state.finalTranscript += t + ' ';
            else interim += t;
          }
          textarea.value = state.baseText + state.finalTranscript + interim;
        };
        state.recognition.onerror = function () { /* non-fatal -- audio recording keeps going regardless */ };
        state.recognition.onend = function () {
          // continuous mode still auto-stops after a silence gap on some
          // browsers -- restart it as long as the user hasn't hit stop.
          if (state.recording) { try { state.recognition.start(); } catch (e) {} }
        };
        try { state.recognition.start(); } catch (e) {}
      } else {
        statusEl.textContent = "This browser can't transcribe live, but we'll still record your voice note.";
      }

      state.recording = true;
      state.seconds = 0;
      statusEl.innerHTML = '<span class="rec-dot"></span> Recording&hellip; ' + fmtTime(0);
      state.timer = setInterval(function () {
        state.seconds++;
        statusEl.innerHTML = '<span class="rec-dot"></span> Recording&hellip; ' + fmtTime(state.seconds);
      }, 1000);
      setButtonState(true);
    }

    function stop() {
      state.recording = false;
      clearInterval(state.timer);
      if (state.recognition) { try { state.recognition.stop(); } catch (e) {} }
      if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
      setButtonState(false);
      var recordedSeconds = state.seconds;
      setTimeout(function () {
        statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:var(--good);"></i> Voice note saved (' + fmtTime(recordedSeconds) + ') — tap to re-record';
      }, 200);
    }

    btn.addEventListener('click', function () {
      if (state.recording) stop(); else start();
    });

    return {
      getBlob: function () { return state.blob; },
      getMimeType: function () { return state.mimeType; },
      reset: function () {
        state.blob = null;
        statusEl.textContent = '';
        setButtonState(false);
      },
    };
  }

  return { attach: attach, mediaSupported: mediaSupported, speechSupported: speechSupported };
})();
