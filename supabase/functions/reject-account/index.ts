// Emails an applicant that their account request was rejected.
//
// Security model: the caller only supplies a requestId. The function verifies
// the caller is HR/admin (via their own JWT + RLS), then reads the email
// address, name, and rejection remarks from the database row — so the email
// content cannot be forged by the client. It refuses to send unless the row
// is actually status = 'rejected'.
//
// Deploy:
//   supabase functions deploy reject-account
//
// Email provider — configure ONE of these (Resend wins if both are set):
//   A) Resend (needs a verified domain):
//        RESEND_API_KEY  — from https://resend.com
//        FROM_EMAIL      — e.g. "PSA HRIS <hris@your-domain.gov.ph>"
//   B) Gmail SMTP (no domain needed; use a dedicated office account):
//        GMAIL_USER          — the Gmail address to send from
//        GMAIL_APP_PASSWORD  — app password (requires 2-Step Verification;
//                              create at myaccount.google.com/apppasswords)
// Common (optional):
//   APP_URL     — the deployed site, used for the Appeal button
//   ADMIN_EMAIL — shown as the system administrator contact
//   FROM_NAME   — display name for Gmail sending (default "PSA HRIS")

import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function buildEmail(name: string | null, remarks: string | null, appUrl: string, adminEmail: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hello,";
  const reasonHtml = remarks
    ? `<p>Unfortunately, your account request was not approved for the following reason(s):</p>
       <blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #cbd5e1;background:#f8fafc;color:#334155;">${escapeHtml(remarks).replace(/\r?\n/g, "<br/>")}</blockquote>`
    : `<p>Unfortunately, your account request was not approved.</p>`;
  const contact = adminEmail
    ? `or by contacting the system administrator at <a href="mailto:${escapeHtml(adminEmail)}">${escapeHtml(adminEmail)}</a>`
    : "or by contacting the system administrator";
  const button = appUrl
    ? `<p style="margin:24px 0;">
         <a href="${escapeHtml(appUrl)}"
            style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
           Appeal this decision
         </a>
       </p>
       <p style="color:#64748b;font-size:13px;">The button takes you back to the portal — signing in again files a new request for HR to review.</p>`
    : "";

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6;">
    <h2 style="color:#1d4ed8;">PSA Marinduque — HRIS Portal</h2>
    <p>${greeting}</p>
    ${reasonHtml}
    <p>${appUrl
      ? `You can appeal by clicking the button below ${contact}.`
      : `You can appeal by signing in to the portal again ${contact}.`}</p>
    ${button}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="color:#94a3b8;font-size:12px;">Philippine Statistics Authority · Marinduque Provincial Statistics Office<br/>
    This is an automated message from the Human Resource Information System.</p>
  </div>`;

  const text =
    `${name ? `Hi ${name},` : "Hello,"}\n\n` +
    (remarks
      ? `Unfortunately, your account request was not approved for the following reason(s):\n\n${remarks}\n\n`
      : "Unfortunately, your account request was not approved.\n\n") +
    `You can appeal by signing in again at ${appUrl || "the portal"} ` +
    (adminEmail ? `or by contacting the system administrator at ${adminEmail}.` : "or by contacting the system administrator.");

  return { html, text };
}

async function sendViaResend(apiKey: string, to: string, subject: string, html: string, text: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("FROM_EMAIL") ?? "PSA HRIS <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!resp.ok) throw new Error(`Resend: ${await resp.text()}`);
}

async function sendViaGmail(user: string, appPassword: string, to: string, subject: string, html: string, text: string) {
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: user, password: appPassword },
    },
  });
  try {
    // Gmail rewrites the From address to the authenticated account; only the
    // display name is ours to choose.
    await client.send({
      from: `${Deno.env.get("FROM_NAME") ?? "PSA HRIS"} <${user}>`,
      to,
      subject,
      content: text,
      html,
    });
  } finally {
    // a close() failure must never mask the send() error
    try { await client.close(); } catch { /* already disconnected */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  try {
    const { requestId } = await req.json();
    if (!requestId) return json(400, { error: "requestId is required" });

    // caller must be signed in as HR/admin — checked with the caller's own JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing authorization" });
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: allowed, error: roleError } = await caller.rpc("is_hr_or_admin");
    if (roleError || allowed !== true) return json(403, { error: "not allowed" });

    // read the row server-side; only actually-rejected requests get an email
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: row, error: rowError } = await admin
      .from("account_requests")
      .select("id, email, full_name, status, decision_remarks")
      .eq("id", requestId)
      .single();
    if (rowError || !row) return json(404, { error: "request not found" });
    if (row.status !== "rejected") return json(409, { error: "request is not rejected" });

    const { html, text } = buildEmail(
      row.full_name,
      row.decision_remarks,
      Deno.env.get("APP_URL") ?? "",
      Deno.env.get("ADMIN_EMAIL") ?? "",
    );
    const subject = "Your PSA HRIS account request";

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (resendKey) {
      await sendViaResend(resendKey, row.email, subject, html, text);
    } else if (gmailUser && gmailPass) {
      await sendViaGmail(gmailUser, gmailPass, row.email, subject, html, text);
    } else {
      return json(500, {
        error: "no email provider configured — set RESEND_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD",
      });
    }

    // bookkeeping only — the email is already out, so log but don't fail
    const { error: markError } = await admin.from("account_requests")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", row.id);
    if (markError) console.error("could not set notified_at:", markError.message);

    return json(200, { sent: true });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
