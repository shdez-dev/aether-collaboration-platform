type TransactionalEmail = {
  preview: string;
  category: string;
  title: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  notice: string;
  footerNote: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

/** Table layout and inline colors keep transactional emails readable in clients without CSS support. */
function renderTransactionalEmail(email: TransactionalEmail): string {
  const actionUrl = escapeHtml(email.actionUrl);
  const brandIconUrl = escapeHtml(new URL('/icon-192.png', process.env.FRONTEND_URL || 'https://aether-web.up.railway.app').toString());
  const paragraphs = email.paragraphs.map((paragraph) =>
    `<p style="margin:0 0 15px;color:#D2C4E0;font-family:'Manrope','Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.7;">${escapeHtml(paragraph)}</p>`,
  ).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(email.title)} · Aether</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#191522;color:#F2ECF8;font-family:'Manrope','Segoe UI',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#191522;">${escapeHtml(email.preview)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#191522" style="width:100%;background-color:#191522;">
    <tr><td align="center" style="padding:36px 16px 46px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:580px;border-collapse:separate;">
        <tr><td style="padding:0 3px 19px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;"><img src="${brandIconUrl}" alt="AETHER" width="48" height="48" style="display:block;width:48px;height:48px;border:0;border-radius:9px;"></td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="#262032" style="background-color:#262032;border:1px solid #493B5B;border-radius:18px;padding:34px 38px 35px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
            <tr><td style="padding:0 0 16px;color:#C1A4E7;font-family:'Manrope','Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">${escapeHtml(email.category)}</td></tr>
            <tr><td style="padding:0 0 20px;color:#F2ECF8;font-family:'Sora','Segoe UI',Arial,sans-serif;font-size:27px;font-weight:700;letter-spacing:-1px;line-height:1.3;">${escapeHtml(email.title)}</td></tr>
            <tr><td>${paragraphs}</td></tr>
            <tr><td style="padding:12px 0 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#7452A6" style="background-color:#7452A6;border-radius:10px;">
                <a href="${actionUrl}" style="display:inline-block;padding:14px 22px;border:1px solid #7452A6;border-radius:10px;color:#FFFFFF;font-family:'Manrope','Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.3;text-decoration:none;">${escapeHtml(email.actionLabel)}</a>
              </td></tr></table>
            </td></tr>
            <tr><td bgcolor="#2E263B" style="padding:15px 17px;background-color:#2E263B;border-left:3px solid #C1A4E7;border-radius:0 8px 8px 0;color:#D2C4E0;font-family:'Manrope','Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.65;">${escapeHtml(email.notice)}</td></tr>
            <tr><td style="padding:25px 0 0;color:#B5A4C7;font-family:'Manrope','Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.6;">Si el botón no funciona, copia este enlace y pégalo en tu navegador:<br><a href="${actionUrl}" style="color:#C1A4E7;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${actionUrl}</a></td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:21px 13px 0;color:#9888AB;font-family:'Manrope','Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.65;text-align:center;">${escapeHtml(email.footerNote)}<br>Aether · Todo conectado</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderVerificationEmail(userName: string, verificationLink: string): string {
  return renderTransactionalEmail({
    preview: 'Confirma tu correo para activar tu cuenta de Aether.',
    category: 'VERIFICACIÓN DE CUENTA',
    title: 'Tu espacio comienza aquí.',
    paragraphs: [`Hola, ${userName}.`, 'Confirma que esta dirección de correo te pertenece para activar tu cuenta y empezar a colaborar en Aether.'],
    actionLabel: 'Verificar mi correo', actionUrl: verificationLink,
    notice: 'Este enlace estará disponible durante 24 horas y es de un solo uso.',
    footerNote: 'Si no creaste una cuenta, puedes ignorar este mensaje.',
  });
}

export function renderPasswordResetEmail(userName: string, resetLink: string): string {
  return renderTransactionalEmail({
    preview: 'Restablece la contraseña de tu cuenta de Aether.',
    category: 'SEGURIDAD DE LA CUENTA', title: 'Restablece tu contraseña.',
    paragraphs: [`Hola, ${userName}.`, 'Recibimos una solicitud para cambiar la contraseña de tu cuenta. Usa el botón para elegir una nueva.'],
    actionLabel: 'Restablecer contraseña', actionUrl: resetLink,
    notice: 'Este enlace expira en 1 hora y es de un solo uso.',
    footerNote: 'Si no solicitaste este cambio, ignora este correo. Tu contraseña seguirá igual.',
  });
}

export function renderOrganizationInvitationEmail(inviterName: string, organizationName: string, invitationLink: string): string {
  return renderTransactionalEmail({
    preview: `${inviterName} te invitó a ${organizationName} en Aether.`,
    category: 'INVITACIÓN A UNA ORGANIZACIÓN', title: 'Te invitaron a colaborar.',
    paragraphs: [`${inviterName} te invitó a unirte a ${organizationName} en Aether.`, 'Inicia sesión con la misma dirección de correo que recibió esta invitación para aceptarla.'],
    actionLabel: 'Aceptar invitación', actionUrl: invitationLink,
    notice: 'Esta invitación expira en 7 días.',
    footerNote: 'Si no esperabas esta invitación, puedes ignorar este correo.',
  });
}
