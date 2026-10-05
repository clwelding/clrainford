// Fires on inserts into the public form tables (quote requests, maintenance
// agreement requests, contact messages, job applications) via a database
// trigger that calls net.http_post -- see supabase/schema.sql. Not called
// from any client-side code; only the database itself calls this,
// authenticated by the shared WEBHOOK_SECRET header rather than a user JWT.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;
// Auto-injected into every Edge Function's env by Supabase -- used to fetch
// photos, voice notes and resumes back out of their private Storage buckets
// (see fetchStorageObjectAsBase64 below), which bypasses RLS.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NOTIFY_TO = 'info@clrainford.com';
// send.clrainford.com must be verified in Resend for this sender to work.
const FROM = 'C. L. Rainford Welding & Fabrication <hello@send.clrainford.com>';
const REPLY_TO = 'info@clrainford.com';

// Downloads a private Storage object (service-role, bypasses RLS) and
// base64-encodes it for Resend's `attachments[].content` field.
async function fetchStorageObjectAsBase64(bucket: string, path: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) {
    throw new Error(`Storage fetch failed (${bucket}/${path}): ${res.status} ${await res.text()}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  );
}

// New /quote submission. The DB trigger has already dropped this straight
// into the shop's Intake column (see clrwf_quote_request_to_job in
// supabase/schema.sql) by the time this email goes out -- this is a
// heads-up, not an approval step, so the copy says so explicitly.
// Shared across all four form tables below: voice_note_paths (see
// assets/voice-input.js) live in the private clrwf-voice-notes
// bucket, fetched and attached as real audio files -- the whole point is
// that staff can tap and listen while driving instead of having to read,
// so a "Voice note attached" line plus the file itself, not just the
// transcript already sitting in the text field, is what this needs to do.
function voiceNoteLine(record: Record<string, any>): string {
  const count = Array.isArray(record.voice_note_paths) ? record.voice_note_paths.length : 0;
  return count ? `<p><strong>Voice note:</strong> ${count > 1 ? `${count} recordings` : 'attached'} below — tap to listen.</p>` : '';
}

async function fetchClrwfVoiceNoteAttachments(record: Record<string, any>, labelPrefix: string) {
  const paths: string[] = Array.isArray(record.voice_note_paths) ? record.voice_note_paths : [];
  return Promise.all(paths.map(async (p, i) => ({
    filename: `${labelPrefix}-Voice-Note-${i + 1}.${p.split('.').pop() || 'webm'}`,
    content: await fetchStorageObjectAsBase64('clrwf-voice-notes', p),
  })));
}

// The Jerk Pit builder (custom/jerk-pits.html) stores its picks as a flat
// object of labeled strings/arrays (pitBody, size, cookingSurface,
// fireSystem, doors, airflow[], addOns[]) -- render that shape as a real
// list. Anything else (or an older/unrecognized shape) falls back to a
// raw JSON dump so this never silently drops data it doesn't recognize.
function formatPitConfiguration(config: Record<string, any>): string {
  const KNOWN_SINGLE: [string, string][] = [
    ['pitBody', 'Pit Body'], ['size', 'Size'], ['cookingSurface', 'Cooking Surface'],
    ['fireSystem', 'Fire System'], ['doors', 'Doors'],
  ];
  const KNOWN_MULTI: [string, string][] = [['airflow', 'Airflow'], ['addOns', 'Add-Ons']];
  const isKnownShape = KNOWN_SINGLE.some(([k]) => typeof config[k] === 'string');
  if (!isKnownShape) return `<p><strong>Pit configuration:</strong><br>${escapeHtml(JSON.stringify(config))}</p>`;

  const rows = [
    ...KNOWN_SINGLE.filter(([k]) => config[k]).map(([k, label]) => `<strong>${label}:</strong> ${escapeHtml(config[k])}`),
    ...KNOWN_MULTI.filter(([k]) => Array.isArray(config[k]) && config[k].length)
      .map(([k, label]) => `<strong>${label}:</strong> ${escapeHtml(config[k].join(', '))}`),
  ];
  return `<p><strong>Pit configuration:</strong><br>${rows.join('<br>')}</p>`;
}

function formatClrwfQuoteRequest(record: Record<string, any>) {
  const categoryLabel: Record<string, string> = {
    residential: 'Residential',
    commercial: 'Commercial',
    'custom-jerk-pit': 'Custom — Jerk Pit',
    'custom-other': 'Custom — Other',
  };
  const photoCount = Array.isArray(record.photo_paths) ? record.photo_paths.length : 0;
  return {
    subject: `New CLRWF Quote Request — ${record.full_name} (${categoryLabel[record.category] || record.category})`,
    html: `
      <h2>New Quote Request — C. L. Rainford Welding &amp; Fabrication</h2>
      <p><strong>From:</strong> ${escapeHtml(record.full_name)} (${escapeHtml(record.email)}${record.phone ? ', ' + escapeHtml(record.phone) : ''})</p>
      <p><strong>Job type:</strong> ${escapeHtml(categoryLabel[record.category] || record.category)}</p>
      ${record.description ? `<p><strong>Description:</strong><br>${escapeHtml(record.description)}</p>` : ''}
      ${record.pit_configuration ? formatPitConfiguration(record.pit_configuration) : ''}
      ${record.budget_range ? `<p><strong>Budget range:</strong> ${escapeHtml(record.budget_range)}</p>` : ''}
      ${record.timeline ? `<p><strong>Timeline:</strong> ${escapeHtml(record.timeline)}</p>` : ''}
      ${photoCount ? `<p><strong>Photos:</strong> ${photoCount} attached below.</p>` : ''}
      ${voiceNoteLine(record)}
      <p style="color:#5b6b7a;font-size:0.85rem;">Already added to the shop board's Intake column automatically — no approval step needed.</p>
    `,
  };
}

// Commercial "Request a Maintenance Agreement" -- a separate lead type
// from clrwf_quote_requests (see schema.sql), so it's flagged distinctly
// here too rather than reusing the quote-request formatter.
function formatClrwfMaintenanceAgreementRequest(record: Record<string, any>) {
  return {
    subject: `New Maintenance Agreement Inquiry — ${record.business_name}`,
    html: `
      <h2>New Maintenance Agreement Inquiry — C. L. Rainford Welding &amp; Fabrication</h2>
      <p><strong>Business:</strong> ${escapeHtml(record.business_name)}</p>
      <p><strong>Contact:</strong> ${escapeHtml(record.contact_name)} (${escapeHtml(record.email)}${record.phone ? ', ' + escapeHtml(record.phone) : ''})</p>
      ${record.property_description ? `<p><strong>Property/equipment:</strong><br>${escapeHtml(record.property_description)}</p>` : ''}
      ${record.service_needs ? `<p><strong>Service needs:</strong><br>${escapeHtml(record.service_needs)}</p>` : ''}
      ${record.message ? `<p><strong>Message:</strong><br>${escapeHtml(record.message)}</p>` : ''}
      ${voiceNoteLine(record)}
      <p style="color:#5b6b7a;font-size:0.85rem;">Recurring commercial lead — track separately from one-off quote requests.</p>
    `,
  };
}

function formatClrwfContactMessage(record: Record<string, any>) {
  return {
    subject: `New CLRWF Contact Message — ${record.name}`,
    html: `
      <h2>New Contact Message — C. L. Rainford Welding &amp; Fabrication</h2>
      <p><strong>From:</strong> ${escapeHtml(record.name)} (${escapeHtml(record.email)})</p>
      <p><strong>Message:</strong><br>${escapeHtml(record.message)}</p>
      ${voiceNoteLine(record)}
    `,
  };
}

function formatClrwfJobApplication(record: Record<string, any>) {
  return {
    subject: `New Job Application — ${record.full_name} (${record.position})`,
    html: `
      <h2>New Job Application — C. L. Rainford Welding &amp; Fabrication</h2>
      <p><strong>Position:</strong> ${escapeHtml(record.position)}</p>
      <p><strong>From:</strong> ${escapeHtml(record.full_name)} (${escapeHtml(record.email)}${record.phone ? ', ' + escapeHtml(record.phone) : ''})</p>
      ${record.cover_letter ? `<p><strong>Why they're interested:</strong><br>${escapeHtml(record.cover_letter)}</p>` : ''}
      ${record.resume_path ? `<p><strong>Resume:</strong> attached below.</p>` : '<p><strong>Resume:</strong> not provided.</p>'}
      ${voiceNoteLine(record)}
      <p style="color:#5b6b7a;font-size:0.85rem;">Review and update status from the Contracts CRM tab.</p>
    `,
  };
}

type Notification = {
  to: (record: Record<string, any>) => string | null | undefined;
  format: (record: Record<string, any>) => { subject: string; html: string };
  // Optional file attachments (Resend's {filename, content: base64} shape).
  attachments?: (record: Record<string, any>) => Promise<{ filename: string; content: string }[]>;
};

type TableConfig = {
  notifications: Notification[];
};

const TABLE_CONFIG: Record<string, TableConfig> = {
  clrwf_quote_requests: {
    notifications: [
      {
        to: () => NOTIFY_TO,
        format: formatClrwfQuoteRequest,
        // clrwf-job-photos and clrwf-voice-notes are both private buckets
        // (see schema.sql) -- base64 attachments, same pattern as
        // security_guard_contracts/lease PDFs, rather than a public link
        // that would 403.
        attachments: async (record) => {
          const paths: string[] = Array.isArray(record.photo_paths) ? record.photo_paths : [];
          const photos = await Promise.all(paths.map(async (p, i) => ({
            filename: `CLRWF-Quote-Photo-${i + 1}.${p.split('.').pop() || 'jpg'}`,
            content: await fetchStorageObjectAsBase64('clrwf-job-photos', p),
          })));
          const voiceNotes = await fetchClrwfVoiceNoteAttachments(record, 'CLRWF-Quote');
          return [...photos, ...voiceNotes];
        },
      },
    ],
  },
  clrwf_maintenance_agreement_requests: {
    notifications: [
      {
        to: () => NOTIFY_TO,
        format: formatClrwfMaintenanceAgreementRequest,
        attachments: (record) => fetchClrwfVoiceNoteAttachments(record, 'CLRWF-Maintenance'),
      },
    ],
  },
  clrwf_contact_messages: {
    notifications: [
      {
        to: () => NOTIFY_TO,
        format: formatClrwfContactMessage,
        attachments: (record) => fetchClrwfVoiceNoteAttachments(record, 'CLRWF-Contact'),
      },
    ],
  },
  clrwf_job_applications: {
    notifications: [
      {
        to: () => NOTIFY_TO,
        format: formatClrwfJobApplication,
        attachments: async (record) => {
          const resume = record.resume_path
            ? [{
                filename: `CLRWF-Application-Resume-${record.full_name || record.id}.${String(record.resume_path).split('.').pop() || 'pdf'}`,
                content: await fetchStorageObjectAsBase64('clrwf-resumes', record.resume_path),
              }]
            : [];
          const voiceNotes = await fetchClrwfVoiceNoteAttachments(record, 'CLRWF-Application');
          return [...resume, ...voiceNotes];
        },
      },
    ],
  },
};

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const payload = await req.json();
    const table: string = payload.table;
    const record = payload.record;

    const config = TABLE_CONFIG[table];
    if (!config) {
      return new Response(JSON.stringify({ skipped: true, reason: `no formatter for table ${table}` }), { status: 200 });
    }

    // Dispatched concurrently, not sequentially -- the trigger's net.http_post
    // call into this function has a hard 5s timeout (pg_net default), so
    // sequential Resend round-trips could add up past it and silently drop
    // the webhook call.
    const results = await Promise.all(config.notifications.map(async (notification) => {
      const to = notification.to(record);
      if (!to) {
        return { skipped: true, reason: 'no recipient email on record' };
      }

      const { subject, html } = notification.format(record);
      const from = FROM;
      const replyTo = REPLY_TO;
      const attachments = notification.attachments ? await notification.attachments(record) : undefined;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, reply_to: replyTo, subject, html, ...(attachments ? { attachments } : {}) }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error('Resend send failed:', resendRes.status, errText);
        return { error: errText };
      }
      return { sent: true, to };
    }));

    const anySent = results.some((r) => r.sent);
    const anyError = results.some((r) => r.error);
    return new Response(JSON.stringify({ results }), { status: anySent || !anyError ? 200 : 502 });
  } catch (e) {
    console.error('notify-submission error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
