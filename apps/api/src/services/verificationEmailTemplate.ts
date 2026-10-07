function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

/** Transactional HTML matching the current dark/orange AETHER interface. */
export function renderVerificationEmail(userName: string, verificationLink: string): string {
  const name = escapeHtml(userName);
  const link = escapeHtml(verificationLink);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>AETHER - Verificación de cuenta</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0d0f12;color:#f4eee2;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;font-size:1px;line-height:1px;color:#0d0f12;max-height:0;max-width:0;opacity:0;overflow:hidden;">Confirma tu correo para activar tu cuenta de AETHER.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:#0d0f12;">
      <tr><td align="center" style="padding:38px 14px 44px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;">
          <tr><td style="padding:0 2px 18px;color:#9c9486;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">AETHER / ACCESO SEGURO</td></tr>
          <tr><td style="background-color:#17191d;border:1px solid #303037;border-bottom:0;border-radius:18px 18px 0 0;padding:27px 38px 25px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>
              <td valign="middle" style="color:#f4eee2;font-size:21px;font-weight:800;letter-spacing:3px;line-height:1.2;"><span style="display:inline-block;background-color:#f2571e;color:#fff;border-radius:8px;padding:7px 10px;margin-right:11px;font-size:16px;letter-spacing:0;">A</span>AETHER</td>
              <td align="right" valign="middle" style="color:#f2571e;font-size:10px;font-weight:700;letter-spacing:1.8px;white-space:nowrap;">01 / 02</td>
            </tr></table>
          </td></tr>
          <tr><td style="background-color:#17191d;padding:43px 38px 38px;border-left:1px solid #303037;border-right:1px solid #303037;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
              <tr><td style="padding:0 0 19px;color:#f2571e;font-size:10px;font-weight:800;letter-spacing:2.2px;line-height:1.5;text-transform:uppercase;">VERIFICACIÓN DE CUENTA</td></tr>
              <tr><td style="padding:0 0 19px;color:#f4eee2;font-size:34px;font-weight:700;letter-spacing:-1.2px;line-height:1.16;">Tu espacio comienza aquí.</td></tr>
              <tr><td style="padding:0 0 28px;color:#b9b0a4;font-size:16px;line-height:1.7;">Hola, ${name}. Confirma que esta dirección de correo te pertenece para activar tu cuenta y continuar en AETHER.</td></tr>
              <tr><td style="padding:0 0 30px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td bgcolor="#f2571e" style="background-color:#f2571e;border-radius:9px;text-align:center;">
                  <a href="${link}" style="display:inline-block;padding:16px 24px;border:1px solid #f2571e;border-radius:9px;color:#fff7f1;font-size:14px;font-weight:700;line-height:1.3;text-decoration:none;">Verificar mi correo&nbsp;&nbsp;→</a>
                </td>
              </tr></table></td></tr>
              <tr><td style="padding:17px 20px;background-color:#2b201b;border-left:3px solid #f2571e;border-radius:0 7px 7px 0;color:#e3c9b9;font-size:13px;line-height:1.6;">Este enlace estará disponible durante <strong>24 horas</strong> y es de un solo uso.</td></tr>
              <tr><td style="padding:29px 0 0;color:#a79d91;font-size:12px;line-height:1.7;">Si el botón no funciona, copia este enlace y pégalo en tu navegador:<br><a href="${link}" style="color:#ff8758;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${link}</a></td></tr>
            </table>
          </td></tr>
          <tr><td style="background-color:#131518;border:1px solid #303037;border-top:0;border-radius:0 0 18px 18px;padding:23px 38px 26px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="color:#a79d91;font-size:12px;line-height:1.65;">¿No creaste una cuenta en AETHER? Puedes ignorar este mensaje; no se activará ninguna cuenta sin tu confirmación.</td></tr>
              <tr><td style="padding-top:17px;color:#f2571e;font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">AETHER - Todo conectado</td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:20px 20px 0;color:#827a70;font-size:11px;line-height:1.6;">Este es un mensaje automático relacionado con la seguridad de tu cuenta.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
