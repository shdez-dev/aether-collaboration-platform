import { renderVerificationEmail } from '../verificationEmailTemplate';

describe('verification email template', () => {
  it('keeps the AETHER email design and the verification action', () => {
    const html = renderVerificationEmail('Ana', 'https://example.com/verify-email?token=abc');

    expect(html).toContain('Tu espacio comienza aquí.');
    expect(html).toContain('VERIFICACIÓN DE CUENTA');
    expect(html).toContain('Verificar mi correo');
    expect(html).toContain('background-color:#0d0f12');
    expect(html).toContain('background-color:#f2571e');
    expect(html).not.toContain('#2345af');
    expect(html).toContain('href="https://example.com/verify-email?token=abc"');
    expect(html).toContain('24 horas');
  });

  it('escapes user-controlled content and links in HTML', () => {
    const html = renderVerificationEmail('<script>alert(1)</script>', 'https://example.com/?a=1&b="bad"');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a=1&amp;b=&quot;bad&quot;');
  });
});
