// C. L. Rainford Welding & Fabrication Supabase client. Loaded sitewide via a
// plain <script> tag (no build step), so the SDK is pulled in with a dynamic
// import() of the CDN ESM build.
//
// The anon key is meant to be public: it only grants what the database's
// Row Level Security policies allow (insert-only for the public forms).
const SUPABASE_URL = 'https://xdjbgcqaynnzykrglgnf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1B4Musk5YF23XHb_BEOiTA_w1DGM5P4';

window.clrwfSupabaseReady = (async () => {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();

window.clrwfSupabase = {
  // Resizes/re-encodes an image client-side (long edge capped at 1600px,
  // JPEG q=0.82) before upload. Keeps the free Storage tier's 1GB budget
  // stretching across many more submitted photos than raw phone photos
  // would allow — a single uncompressed phone photo can be 10-20MB.
  //
  // Optional maxBytes gives this a hard target instead of a single fixed
  // pass: the first pass (1600px/q0.82) already lands well under 1MB for
  // almost any input, but a handful of phones (very high megapixel counts,
  // or a raw/near-uncompressed camera photo) can still clear a bucket's
  // upload cap on that first pass — so when maxBytes is given, it keeps
  // stepping quality and then resolution down until the result actually
  // fits, rather than uploading something the bucket will just reject.
  async _compressImage(file, maxBytes) {
    const bitmap = await createImageBitmap(file);
    const encode = (edge, quality) => {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    };

    let edge = 1600;
    let quality = 0.82;
    let blob = await encode(edge, quality);

    while (maxBytes && blob && blob.size > maxBytes && (quality > 0.35 || edge > 500)) {
      if (quality > 0.35) quality = Math.max(0.35, quality - 0.15);
      else edge = Math.max(500, Math.round(edge * 0.75));
      blob = await encode(edge, quality);
    }

    return blob || file;
  },

  // Uploads recorded voice-note blobs (see assets/voice-input.js) to
  // the private clrwf-voice-notes bucket, one file per blob. Extension is
  // derived from the blob's own recorded mimeType rather than hardcoded,
  // since MediaRecorder's output format varies by browser (webm/opus in
  // Chrome, mp4 in Safari) -- notify-submission's attachment filenames
  // reuse whatever extension lands in the path, same convention as photos.
  async _uploadClrwfVoiceNotes(voiceNotes, stamp) {
    const paths = [];
    for (let i = 0; i < (voiceNotes || []).length; i++) {
      const note = voiceNotes[i];
      if (!note || !note.blob) continue;
      const ext = (note.mimeType || '').includes('mp4') ? 'mp4' : (note.mimeType || '').includes('ogg') ? 'ogg' : 'webm';
      const path = `${stamp}-voice-${i + 1}.${ext}`;
      const client = await window.clrwfSupabaseReady;
      const { error } = await client.storage.from('clrwf-voice-notes').upload(path, note.blob, {
        contentType: note.mimeType || 'audio/webm',
      });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  },

  // Photos go to the private clrwf-job-photos bucket: anon can insert but
  // never read back. The DB trigger on clrwf_quote_requests auto-creates the
  // client + job row in Intake.
  async submitClrwfQuoteRequest({ fullName, email, phone, category, description, budgetRange, timeline, photoFiles, pitConfiguration, voiceNotes }) {
    const client = await window.clrwfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    const photoPaths = [];
    for (let i = 0; i < (photoFiles || []).length; i++) {
      const compressed = await this._compressImage(photoFiles[i]);
      const path = `${stamp}-photo-${i + 1}.jpg`;
      const { error } = await client.storage.from('clrwf-job-photos').upload(path, compressed, {
        contentType: 'image/jpeg',
      });
      if (error) throw error;
      photoPaths.push(path);
    }

    const voiceNotePaths = await this._uploadClrwfVoiceNotes(voiceNotes, stamp);

    const { error } = await client.from('clrwf_quote_requests').insert({
      full_name: fullName,
      email,
      phone: phone || null,
      category,
      description: description || null,
      budget_range: budgetRange || null,
      timeline: timeline || null,
      photo_paths: photoPaths,
      pit_configuration: pitConfiguration || null,
      voice_note_paths: voiceNotePaths,
    });
    if (error) throw error;
  },

  // Distinct from submitClrwfQuoteRequest -- see schema.sql's
  // clrwf_maintenance_agreement_requests comment for why recurring
  // commercial leads are tracked separately from one-off quotes.
  async submitClrwfMaintenanceAgreementRequest({ businessName, contactName, email, phone, propertyDescription, serviceNeeds, message, voiceNotes }) {
    const client = await window.clrwfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const voiceNotePaths = await this._uploadClrwfVoiceNotes(voiceNotes, stamp);
    const { error } = await client.from('clrwf_maintenance_agreement_requests').insert({
      business_name: businessName,
      contact_name: contactName || null,
      email,
      phone: phone || null,
      property_description: propertyDescription || null,
      service_needs: serviceNeeds || null,
      message: message || null,
      voice_note_paths: voiceNotePaths,
    });
    if (error) throw error;
  },

  async submitClrwfContactMessage({ name, email, message, voiceNotes }) {
    const client = await window.clrwfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const voiceNotePaths = await this._uploadClrwfVoiceNotes(voiceNotes, stamp);
    const { error } = await client.from('clrwf_contact_messages').insert({ name, email, message, voice_note_paths: voiceNotePaths });
    if (error) throw error;
  },

  // Careers application, shared by every posting under careers/
  // (position is passed explicitly since there's more than one opening).
  // Resume goes to the private clrwf-resumes bucket -- same
  // write-only-from-anon pattern as photos and voice notes (never readable
  // back except by staff).
  async submitClrwfJobApplication({ position, fullName, email, phone, coverLetter, resumeFile, voiceNotes }) {
    const client = await window.clrwfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    let resumePath = null;
    if (resumeFile) {
      const ext = (resumeFile.name.split('.').pop() || 'pdf').toLowerCase();
      resumePath = `${stamp}-resume.${ext}`;
      const { error } = await client.storage.from('clrwf-resumes').upload(resumePath, resumeFile, {
        contentType: resumeFile.type || 'application/octet-stream',
      });
      if (error) throw error;
    }

    const voiceNotePaths = await this._uploadClrwfVoiceNotes(voiceNotes, stamp);

    const { error } = await client.from('clrwf_job_applications').insert({
      position,
      full_name: fullName,
      email,
      phone: phone || null,
      cover_letter: coverLetter || null,
      resume_path: resumePath,
      voice_note_paths: voiceNotePaths,
    });
    if (error) throw error;
  },
};
