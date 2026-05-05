import { Resend } from "resend";
import { logger } from "./logger";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env["RESEND_API_KEY"]) return null;
  if (!resend) resend = new Resend(process.env["RESEND_API_KEY"]);
  return resend;
}

export async function sendInviteEmail(opts: {
  toEmail: string;
  toName: string;
  invitedByName: string;
  role: string;
  acceptUrl: string;
}): Promise<void> {
  const client = getResend();

  if (!client) {
    logger.warn(
      { acceptUrl: opts.acceptUrl },
      "RESEND_API_KEY not set — invite link logged instead of emailed"
    );
    return;
  }

  const roleLabel =
    opts.role.charAt(0).toUpperCase() + opts.role.slice(1);

  await client.emails.send({
    from: "Ops & Planning <no-reply@resend.dev>",
    to: opts.toEmail,
    subject: `${opts.invitedByName} invited you to Ops & Planning`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">You've been invited</h2>
        <p style="color:#555">
          <strong>${opts.invitedByName}</strong> has invited you to join 
          <strong>Ops &amp; Planning</strong> as a <strong>${roleLabel}</strong>.
        </p>
        <p style="color:#555">
          Click the button below to create your account. This link expires in 72&nbsp;hours.
        </p>
        <a href="${opts.acceptUrl}"
          style="display:inline-block;margin-top:16px;padding:12px 24px;
                 background:#2563EB;color:#fff;border-radius:8px;
                 text-decoration:none;font-weight:600">
          Accept Invitation
        </a>
        <hr style="margin:32px 0;border:none;border-top:1px solid #eee"/>
        <p style="font-size:12px;color:#999">
          If you weren't expecting this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
