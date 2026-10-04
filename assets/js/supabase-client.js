// SelassieFest shared Supabase client. Loaded sitewide via a plain <script> tag
// (no build step), so the SDK is pulled in with a dynamic import() of the CDN
// ESM build. See supabase/schema.sql for the tables this talks to.
//
// Fill in these two values from Project Settings -> API in the Supabase
// dashboard. The anon key is meant to be public — it only grants what the
// Row Level Security policies in schema.sql allow (insert-only, no read-back).
const SUPABASE_URL = 'https://xdjbgcqaynnzykrglgnf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1B4Musk5YF23XHb_BEOiTA_w1DGM5P4';

window.sfSupabaseReady = (async () => {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();

window.sfSupabase = {
  async subscribeNewsletter(email, source = null) {
    const client = await window.sfSupabaseReady;
    // Plain insert, not upsert: upsert asks PostgREST to select the row back
    // to report whether it inserted or ignored a duplicate, which needs a
    // SELECT policy we intentionally don't grant (write-only table). A
    // duplicate email just throws a unique-violation (code 23505), which
    // callers already treat as a friendly "you're already subscribed".
    const { error } = await client.from('newsletter_subscribers').insert({ email, source });
    if (error) throw error;
  },

  async submitAnansiStory({ name, email, storyTitle, storyText }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('anansi_story_submissions').insert({
      name,
      email,
      story_title: storyTitle,
      story_text: storyText,
    });
    if (error) throw error;
  },

  async submitVolunteerSignup({ fullName, email, phone, age, roleChoice, shiftPreference, tshirtSize, emergencyContact, accommodations, referralSource, waiverAccepted }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('volunteer_signups').insert({
      full_name: fullName,
      email,
      phone,
      age,
      role_choice: roleChoice,
      shift_preference: shiftPreference,
      tshirt_size: tshirtSize,
      emergency_contact: emergencyContact,
      accommodations,
      referral_source: referralSource,
      waiver_accepted: waiverAccepted,
    });
    if (error) throw error;
  },

  async submitSponsorInquiry({ sourcePage, email, fields }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('sponsor_inquiries').insert({
      source_page: sourcePage,
      email,
      fields,
    });
    if (error) throw error;
  },

  async submitCampRegistration({ camperName, guardianName, guardianEmail, guardianPhone, registrationData }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('camp_registrations').insert({
      camper_name: camperName,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone: guardianPhone,
      registration_data: registrationData,
    });
    if (error) throw error;
  },

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

  // Uploads an optional photo + optional video (max 50MB, matching both
  // Supabase's free-tier per-file cap and the bucket's own configured
  // limit) to the game-submissions Storage bucket, then records the
  // submission. Videos are a TEMPORARY holding spot -- staff move approved
  // ones to YouTube by hand and delete the Storage copy (see schema.sql).
  async submitGameStory({ gameSlug, gameName, submitterName, submitterEmail, storyText, photoFile, videoFile }) {
    const MAX_BYTES = 50 * 1024 * 1024;
    if (videoFile && videoFile.size > MAX_BYTES) {
      throw new Error('Video is too large (50MB max). Please trim it and try again.');
    }

    const client = await window.sfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    let photoPath = null;
    if (photoFile) {
      const compressed = await this._compressImage(photoFile);
      photoPath = `${gameSlug}/${stamp}-photo.jpg`;
      const { error } = await client.storage.from('game-submissions').upload(photoPath, compressed, {
        contentType: 'image/jpeg',
      });
      if (error) throw error;
    }

    let videoPath = null;
    if (videoFile) {
      const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase();
      videoPath = `${gameSlug}/${stamp}-video.${ext}`;
      const { error } = await client.storage.from('game-submissions').upload(videoPath, videoFile, {
        contentType: videoFile.type || 'video/mp4',
      });
      if (error) throw error;
    }

    const { error } = await client.from('game_submissions').insert({
      game_slug: gameSlug,
      game_name: gameName,
      submitter_name: submitterName,
      submitter_email: submitterEmail || null,
      story_text: storyText || null,
      photo_path: photoPath,
      video_path: videoPath,
    });
    if (error) throw error;
  },

  // Uploads an optional logo + optional product photos (max 5, matching the
  // vendor package's "3-5 images" request) to the vendor-applications
  // Storage bucket, then records the application. Photos are compressed
  // client-side via _compressImage, same as submitGameStory above.
  async submitVendorApplication({ businessName, contactEmail, productDescription, webpageHighlight, marketingPlan, preferredSpace, logoFile, photoFiles }) {
    const client = await window.sfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    let logoPath = null;
    if (logoFile) {
      const compressed = await this._compressImage(logoFile);
      logoPath = `${stamp}-logo.jpg`;
      const { error } = await client.storage.from('vendor-applications').upload(logoPath, compressed, {
        contentType: 'image/jpeg',
      });
      if (error) throw error;
    }

    const photoPaths = [];
    for (let i = 0; i < (photoFiles || []).length; i++) {
      const compressed = await this._compressImage(photoFiles[i]);
      const path = `${stamp}-photo-${i + 1}.jpg`;
      const { error } = await client.storage.from('vendor-applications').upload(path, compressed, {
        contentType: 'image/jpeg',
      });
      if (error) throw error;
      photoPaths.push(path);
    }

    const { error } = await client.from('vendor_applications').insert({
      business_name: businessName,
      contact_email: contactEmail,
      product_description: productDescription,
      webpage_highlight: webpageHighlight || null,
      marketing_plan: marketingPlan,
      preferred_space: preferredSpace || null,
      logo_path: logoPath,
      photo_paths: photoPaths,
    });
    if (error) throw error;
  },

  // Uploads the client-generated signed contract PDF to the private
  // security-guard-contracts bucket, then records the submission. The
  // notify-submission Edge Function picks the PDF back up (service role,
  // bypasses this bucket's no-public-read policy) and emails it to Stephen.
  async submitSecurityGuardContract({ vendorCompanyName, vendorAddress, vendorContact, guardNames, signerName, signerTitle, pdfBlob }) {
    const client = await window.sfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const pdfPath = `${stamp}.pdf`;

    const { error: uploadError } = await client.storage.from('security-guard-contracts').upload(pdfPath, pdfBlob, {
      contentType: 'application/pdf',
    });
    if (uploadError) throw uploadError;

    const { error } = await client.from('security_guard_contracts').insert({
      vendor_company_name: vendorCompanyName,
      vendor_address: vendorAddress || null,
      vendor_contact: vendorContact || null,
      guard_names: guardNames || null,
      signer_name: signerName,
      signer_title: signerTitle || null,
      pdf_path: pdfPath,
    });
    if (error) throw error;
  },

  // Reads from plates_for_purpose_restaurants_public (a view, not the base
  // table) -- the ask page passes the ?r=<slug> from its own URL. Returns
  // null if the slug doesn't match any restaurant (bad/old QR code), which
  // the calling page treats as "show a fallback, don't crash".
  async fetchPlatesForPurposeRestaurant(slug) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client
      .from('plates_for_purpose_restaurants_public')
      .select('slug, business_name, address, donation_ask, target_ask_value, suggested_donation, logo_path, offer_choices, offer_note')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Aggregate-only count (see plates_for_purpose_confirmed_count in
  // schema.sql) -- never exposes which specific restaurants have confirmed,
  // only how many. Returns 0 on any error so a hiccup here just hides the
  // social-proof line rather than breaking the page.
  async fetchPlatesForPurposeConfirmedCount() {
    try {
      const client = await window.sfSupabaseReady;
      const { data, error } = await client
        .from('plates_for_purpose_confirmed_count')
        .select('confirmed_count')
        .maybeSingle();
      if (error) throw error;
      return data ? data.confirmed_count : 0;
    } catch (err) {
      console.error('Failed to fetch confirmed count:', err);
      return 0;
    }
  },

  async submitPlatesForPurposeResponse({
    restaurantSlug,
    businessName,
    decision,
    offerDetails,
    respondentName,
    respondentTitle,
    email,
    contactInfo,
    message,
  }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('plates_for_purpose_responses').insert({
      restaurant_slug: restaurantSlug,
      business_name: businessName,
      decision,
      offer_details: offerDetails || null,
      respondent_name: respondentName || null,
      respondent_title: respondentTitle || null,
      email: email || null,
      contact_info: contactInfo || null,
      message: message || null,
    });
    if (error) throw error;
  },

  // Reads from game_submissions_public (a view, not the base table) --
  // pre-filtered to status='approved' and missing submitter_email entirely,
  // so this is safe to call from any page without further filtering.
  async fetchApprovedGameSubmissions(gameSlug, limit = 12) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client
      .from('game_submissions_public')
      .select('id, submitter_name, story_text, photo_path, video_path, created_at')
      .eq('game_slug', gameSlug)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // 2nd Chance Housing lease e-signature bridge (see supabase/schema.sql's
  // "lease e-signature bridge" section) -- unrelated to SelassieFest itself,
  // just reusing this already-configured Supabase project. get_lease_signing_request
  // is a security-definer RPC, not a table select, so it's the only way this
  // (public, unauthenticated) page can ever read a single lease record --
  // it returns null for an unknown id or one already marked completed.
  async fetchLeaseSigningRequest(id) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('get_lease_signing_request', { request_id: id });
    if (error) throw error;
    return (data && data[0]) || null;
  },

  async submitLeaseSignature({ requestId, tenantName, tenantEmail, unitLabel, signedData, signatureTypedName, pdfBlob }) {
    const client = await window.sfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const pdfPath = `${stamp}.pdf`;

    const { error: uploadError } = await client.storage.from('lease-signed-pdfs').upload(pdfPath, pdfBlob, {
      contentType: 'application/pdf',
    });
    if (uploadError) throw uploadError;

    const { error } = await client.from('lease_signatures').insert({
      request_id: requestId,
      tenant_name: tenantName,
      tenant_email: tenantEmail,
      unit_label: unitLabel || null,
      signed_data: signedData,
      signature_typed_name: signatureTypedName,
      pdf_path: pdfPath,
    });
    if (error) throw error;
  },

  // Documentary appearance releases for "Anatomy of a Shoreline" (night-out/).
  // Write-only insert, same convention as everything above -- see
  // supabase/night-out-releases.sql. The AFTER INSERT trigger emails a staff
  // copy and a copy back to the signer; that second email is what provides
  // the signer with a record of what they signed, so there is no PDF to
  // generate and no storage bucket here.
  async submitAppearanceRelease({ releaseType, subjectName, signerName, signerRelationship, signerEmail, signerPhone, filmedLocation, filmedDate, releaseVersion, electronicConsent, signatureTypedName, userAgent, sourcePage }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('night_out_appearance_releases').insert({
      release_type: releaseType,
      subject_name: subjectName,
      signer_name: signerName,
      signer_relationship: signerRelationship || null,
      signer_email: signerEmail,
      signer_phone: signerPhone || null,
      filmed_location: filmedLocation || null,
      filmed_date: filmedDate || null,
      release_version: releaseVersion,
      electronic_consent: electronicConsent === true,
      signature_typed_name: signatureTypedName,
      user_agent: userAgent || null,
      source_page: sourcePage || null,
    });
    if (error) throw error;
  },

  // 63rd Street Bongo Beach Park Advisory Council (bbpac/) -- a Ras Tafari
  // Inc. community initiative, separate from the SelassieFest festival itself
  // but sharing this same Supabase project. All six tables below are
  // write-only inserts, same convention as everything above.
  async bbpacMeetingNotify(email) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_meeting_notify').insert({ email });
    if (error) throw error;
  },

  async bbpacVolunteerSignup({ fullName, email, phone, interestArea, availability }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_volunteer_signups').insert({
      full_name: fullName,
      email,
      phone: phone || null,
      interest_area: interestArea || null,
      availability: availability || null,
    });
    if (error) throw error;
  },

  async bbpacMembershipSignup({ fullName, email, membershipLevel, message }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_membership_signups').insert({
      full_name: fullName,
      email,
      membership_level: membershipLevel || null,
      message: message || null,
    });
    if (error) throw error;
  },

  async bbpacSponsorInquiry({ businessName, contactName, email, message }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_sponsor_inquiries').insert({
      business_name: businessName,
      contact_name: contactName || null,
      email,
      message: message || null,
    });
    if (error) throw error;
  },

  async bbpacVendorApplication({ businessName, contactName, email, productDescription, preferredEvent }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_vendor_applications').insert({
      business_name: businessName,
      contact_name: contactName || null,
      email,
      product_description: productDescription || null,
      preferred_event: preferredEvent || null,
    });
    if (error) throw error;
  },

  async bbpacContactMessage({ name, email, topic, message }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_contact_messages').insert({
      name,
      email,
      topic: topic || null,
      message,
    });
    if (error) throw error;
  },

  async bbpacPhotoSubmission({ name, email, description, era }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_photo_submissions').insert({
      name,
      email,
      description: description || null,
      era: era || null,
    });
    if (error) throw error;
  },

  // Uploads recorded voice-note blobs (see clrwf/assets/voice-input.js) to
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
      const client = await window.sfSupabaseReady;
      const { error } = await client.storage.from('clrwf-voice-notes').upload(path, note.blob, {
        contentType: note.mimeType || 'audio/webm',
      });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  },

  // C. L. Rainford Welding & Fabrication (clrwf/) -- unrelated business,
  // same shared-project pattern as bbpac/ above. Photos go to the private
  // clrwf-job-photos bucket (see schema.sql) -- anon can insert but never
  // read back, same as every other write-only form here. The DB trigger on
  // clrwf_quote_requests auto-creates the client + job row in Intake; no
  // approval step, unlike bbpac's section-signup flow.
  async submitClrwfQuoteRequest({ fullName, email, phone, category, description, budgetRange, timeline, photoFiles, pitConfiguration, voiceNotes }) {
    const client = await window.sfSupabaseReady;
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
    const client = await window.sfSupabaseReady;
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
    const client = await window.sfSupabaseReady;
    const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const voiceNotePaths = await this._uploadClrwfVoiceNotes(voiceNotes, stamp);
    const { error } = await client.from('clrwf_contact_messages').insert({ name, email, message, voice_note_paths: voiceNotePaths });
    if (error) throw error;
  },

  // Careers application, shared by every posting under clrwf/careers/
  // (position is passed explicitly since there's more than one opening).
  // Resume goes to the private clrwf-resumes bucket -- same
  // write-only-from-anon pattern as photos and voice notes (never readable
  // back except by staff).
  // BIOS102 (/BIOS102/) -- unrelated UWP course site sharing this project.
  // Real magic-link login: this just inserts the request row -- RLS itself
  // (bios102_is_enrolled, see schema.sql) rejects it for an email that
  // isn't on the roster, so a rejected insert IS the "not enrolled" signal.
  // The actual sign-in email is sent by the row's insert trigger
  // (notify_submission_webhook -> notify-submission's formatBios102LoginLink),
  // not by this call.
  async bios102RequestLoginLink(email) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bios102_login_links').insert({ email });
    if (error) throw error;
  },

  // Called from /BIOS102/verify.html with the token out of the emailed
  // link's URL. Returns { session_token, email, display_name } on success
  // (session_token is just the same token, confirmed valid -- the caller
  // keeps it as the ongoing session credential) or null for an unknown/
  // never-activated-and-expired token.
  async bios102VerifyLoginLink(token) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('bios102_verify_login_link', { p_token: token });
    if (error) throw error;
    return (data && data[0]) || null;
  },

  // Loads every comparison table a student has built across all exercises.
  // sessionToken is resolved back to an email server-side (see
  // bios102_load_tables in schema.sql) -- this page never sends an email
  // directly, so it can't be pointed at anyone else's tables.
  async bios102LoadStudentTables(sessionToken) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('bios102_load_tables', { p_session: sessionToken });
    if (error) throw error;
    return data || [];
  },

  // Upsert keyed on (email, exercise_number, table_name) -- see schema.sql's
  // unique constraint. Table build is entirely student-directed (which
  // columns/rows to keep); the email it's saved under comes from the
  // session token server-side, same as bios102LoadStudentTables above.
  async bios102SaveStudentTable({ sessionToken, exerciseNumber, tableName, columns, rows }) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('bios102_save_table', {
      p_session: sessionToken,
      p_exercise_number: exerciseNumber,
      p_table_name: tableName,
      p_columns: columns,
      p_rows: rows,
    });
    if (error) throw error;
    return (data && data[0]) || null;
  },

  // Uploads a photo (drawing or specimen snapshot) for one row of a
  // student's BIOS102 comparison table, compressed the same way as every
  // other photo upload on this site. Returns the public URL, which the
  // caller stores directly in that row's own JSON (photoPath) -- no
  // separate table/column, no session token needed here since the bucket
  // is public and write-only-by-anyone (see schema.sql), same trust model
  // as the rest of BIOS102's low-stakes student data.
  async bios102UploadOrganismPhoto(file) {
    const client = await window.sfSupabaseReady;
    // 9MB target, not the bucket's full 10MB cap -- leaves headroom so the
    // compressed file still clears the limit after Supabase's own storage
    // overhead, rather than landing right on the edge.
    const compressed = await this._compressImage(file, 9 * 1024 * 1024);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await client.storage.from('bios102-organism-photos').upload(path, compressed, {
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    const { data } = client.storage.from('bios102-organism-photos').getPublicUrl(path);
    return data.publicUrl;
  },

  // Pilobolus data sheet (/BIOS102/pilobolus.html) -- see
  // supabase/bios102-pilobolus-schema.sql. Load returns every group's rows
  // (pooled class data, no emails); save upserts one (group, light
  // condition) row. Both validate the session token server-side.
  async bios102LoadPilobolus(sessionToken) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('bios102_load_pilobolus', { p_session: sessionToken });
    if (error) throw error;
    return data || [];
  },

  async bios102SavePilobolus({ sessionToken, groupNumber, lightCondition, myceliumSquares, developing, developed, shot, observations }) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.rpc('bios102_save_pilobolus', {
      p_session: sessionToken,
      p_group_number: groupNumber,
      p_light_condition: lightCondition,
      p_mycelium_squares: myceliumSquares,
      p_developing: developing,
      p_developed: developed,
      p_shot: shot,
      p_observations: observations || '',
    });
    if (error) throw error;
  },

  // BBPAC Opportunity Tracker (/bbpac/organization/opportunity-tracker.html)
  // -- same magic-link pattern as BIOS102 above, applied to a volunteer
  // roster instead of a class roster. See schema.sql's bbpac_tracker_*
  // section for why reads are open (anon select policy on the items/updates
  // tables) but every write goes through a session-validating function.
  async bbpacTrackerRequestLogin(email) {
    const client = await window.sfSupabaseReady;
    const { error } = await client.from('bbpac_tracker_login_links').insert({ email });
    if (error) throw error;
  },

  // Called with the token out of the emailed link's URL (?token=...).
  // Returns { session_token, email, display_name } on success, or throws if
  // the token is unknown or an expired 'pending' link -- see
  // bbpac_tracker_verify_login_link in schema.sql.
  async bbpacTrackerVerifyLogin(token) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('bbpac_tracker_verify_login_link', { p_token: token });
    if (error) throw error;
    if (!data || !data.length) throw new Error('That sign-in link is invalid or has expired.');
    return data[0];
  },

  async bbpacTrackerLoadItems() {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client
      .from('bbpac_tracker_items')
      .select('id, sheet, sort_order, title, link, fields, track_status, deadline_date, updated_at')
      .order('sheet', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async bbpacTrackerLoadUpdates() {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client
      .from('bbpac_tracker_updates')
      .select('id, item_id, status, note, volunteer_name, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // The only write path -- validates sessionToken server-side (see
  // bbpac_tracker_add_update in schema.sql), so a volunteer can only ever
  // post under their own verified identity.
  async bbpacTrackerAddUpdate({ sessionToken, itemId, status, note }) {
    const client = await window.sfSupabaseReady;
    const { data, error } = await client.rpc('bbpac_tracker_add_update', {
      p_session: sessionToken,
      p_item_id: itemId,
      p_status: status,
      p_note: note || null,
    });
    if (error) throw error;
    return data && data[0];
  },

  async submitClrwfJobApplication({ position, fullName, email, phone, coverLetter, resumeFile, voiceNotes }) {
    const client = await window.sfSupabaseReady;
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
