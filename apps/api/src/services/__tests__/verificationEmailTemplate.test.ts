import { renderOrganizationInvitationEmail, renderPasswordResetEmail, renderVerificationEmail } from '../emailTemplates';

describe('verification email template', () => {
  it('uses the current Aether palette and keeps the verification action', () => {
    const html = renderVerificationEmail('Ana', 'https://example.com/verify-email?token=abc');

    expect(html).toContain('Tu espacio comienza aquí.');
    expect(html).toContain('VERIFICACIÓN DE CUENTA');
    expect(html).toContain('Verificar mi correo');
    expect(html).toContain('background-color:#191522');
    expect(html).toContain('background-color:#7452A6');
    expect(html).toContain('/icon-192.png');
    expect(html).toContain('alt="AETHER"');
    expect(html).toContain("'Sora'");
    expect(html).toContain("'Manrope'");
    expect(html.toLowerCase()).not.toContain('#f2571e');
    expect(html).toContain('href="https://example.com/verify-email?token=abc"');
    expect(html).toContain('24 horas');
  });

  it('uses the same template for password recovery', () => {
    const html = renderPasswordResetEmail('Ana', 'https://example.com/reset-password?token=abc');

    expect(html).toContain('Restablecer contraseña');
    expect(html).toContain('href="https://example.com/reset-password?token=abc"');
    expect(html).toContain('1 hora');
    expect(html).toContain('background-color:#7452A6');
  });

  it('styles organization invitations and escapes dynamic content', () => {
    const html = renderOrganizationInvitationEmail('<Ana>', 'Equipo "Aurora"', 'https://example.com/invite?a=1&b=2');

    expect(html).toContain('Aceptar invitación');
    expect(html).toContain('7 días');
    expect(html).toContain('&lt;Ana&gt;');
    expect(html).toContain('Equipo &quot;Aurora&quot;');
    expect(html).toContain('href="https://example.com/invite?a=1&amp;b=2"');
    expect(html).not.toContain('<Ana>');
  });

  it('escapes user-controlled content and links in HTML', () => {
    const html = renderVerificationEmail('<script>alert(1)</script>', 'https://example.com/?a=1&b="bad"');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a=1&amp;b=&quot;bad&quot;');
  });
});
