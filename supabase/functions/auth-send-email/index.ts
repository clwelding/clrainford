// Supabase Auth "Send Email" Hook. Once enabled in the Dashboard
// (Authentication -> Auth Hooks -> Send Email), GoTrue calls THIS function
// for every auth email on the project -- magic link, signup confirmation,
// password recovery, invite, email change -- and it sends them through
// Resend as C. L. Rainford Welding & Fabrication. The built-in Email
// Templates / SMTP settings in the Dashboard stop being used once this hook
// is active.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "").replace("v1,whsec_", "");
// clrainford.com must be verified in Resend for this sender to work.
const FROM = "C. L. Rainford Welding & Fabrication <hello@clrainford.com>";
const SITE = "https://clrainford.com";

function escapeHtml(s: unknown) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

type EmailData = {
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
};

// Routed through the click-through confirm page (fixes email-scanner
// "phantom link" clicks that would otherwise burn the one-time token)
// instead of GoTrue's direct verify link. confirm-login.html enforces its
// own redirect allowlist, so an unexpected redirect_to falls back to the
// portal there.
function buildLink(d: EmailData) {
  const redirectTo = d.redirect_to || `${SITE}/portal.html`;
  return `${SITE}/confirm-login.html?token_hash=${encodeURIComponent(d.token_hash)}&redirect_to=${encodeURIComponent(redirectTo)}`;
}

const LINK_SUBJECTS: Record<string, string> = {
  signup: "Confirm your sign-up",
  magiclink: "Your sign-in link",
  email: "Your sign-in link",
  invite: "You've been invited",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Confirm it's you",
};

function renderLinkEmail(actionType: string, link: string) {
  const subject = LINK_SUBJECTS[actionType] || "Action required";
  const verb = actionType === "recovery" ? "reset your password"
    : actionType === "invite" ? "accept your invitation"
    : actionType === "email_change" ? "confirm your new email"
    : "sign in";
  const buttonLabel = verb === "sign in" ? "Sign in" : "Continue";
  return {
    subject,
    html: `<h2>${escapeHtml(subject)}</h2><p>Follow the link below to ${verb}. This link expires shortly and can only be used once.</p><p><a href="${link}">${buttonLabel}</a></p>`,
  };
}

// Pure informational notifications (no token_hash, nothing to click) --
// not currently triggered by anything on this project, but handled so the
// hook never errors outright if one ever is.
const NOTIFICATION_SUBJECTS: Record<string, string> = {
  password_changed_notification: "Your password was changed",
  email_changed_notification: "Your email was changed",
  phone_changed_notification: "Your phone number was changed",
  identity_linked_notification: "A new sign-in method was linked to your account",
  identity_unlinked_notification: "A sign-in method was removed from your account",
  mfa_factor_enrolled_notification: "Two-factor authentication was enabled",
  mfa_factor_unenrolled_notification: "Two-factor authentication was disabled",
};

Deno.serve(async (req) => {
  var payload: string, headers: Record<string, string>;
  try {
    payload = await req.text();
    headers = Object.fromEntries(req.headers);
  } catch (err) {
    console.error("auth-send-email: failed to read request", err instanceof Error ? err.stack || err.message : String(err));
    return new Response(JSON.stringify({ error: { http_code: 500, message: "Failed to read request" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let user: { email: string }, email_data: EmailData;
  try {
    const wh = new Webhook(HOOK_SECRET);
    const verified = wh.verify(payload, headers) as { user: { email: string }; email_data: EmailData };
    user = verified.user;
    email_data = verified.email_data;
  } catch (err) {
    console.error("auth-send-email: webhook signature verification failed", err instanceof Error ? err.message : String(err), "HOOK_SECRET set:", !!HOOK_SECRET);
    return new Response(JSON.stringify({ error: { http_code: 401, message: "Invalid webhook signature" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const actionType = email_data.email_action_type;

    let subject: string, html: string;
    if (NOTIFICATION_SUBJECTS[actionType]) {
      subject = NOTIFICATION_SUBJECTS[actionType];
      html = `<p>${escapeHtml(subject)}. If this wasn't you, contact us immediately.</p>`;
    } else {
      const link = buildLink(email_data);
      ({ subject, html } = renderLinkEmail(actionType, link));
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: user.email, subject, html }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("auth-send-email: Resend API rejected the send", resendRes.status, errText);
      return new Response(JSON.stringify({ error: { http_code: 500, message: `Email send failed: ${errText}` } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("auth-send-email: uncaught error in handler", err instanceof Error ? err.stack || err.message : String(err));
    return new Response(JSON.stringify({ error: { http_code: 500, message: (err as Error).message || "Unknown error" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
