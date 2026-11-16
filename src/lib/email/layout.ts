// Branded HTML email, shared by every message Gzad sends: sign-in codes
// (rendered into the Supabase templates), billing alerts and the contact form.
// Email clients ignore most CSS, so this is tables and inline styles; the
// <style> block only adds dark mode where the client supports it.

const C = {
  page: '#f5f5f7',
  card: '#ffffff',
  ink: '#1d1d1f',
  copy: '#424245',
  muted: '#6e6e73',
  line: '#e5e5ea',
  accent: '#0b4d3c',
  accentSoft: '#eaf4ee',
  onAccent: '#ffffff',
  warning: '#9a4b00',
  warningSoft: '#fff4e5',
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Noto Sans Georgian',sans-serif"
const MONO = "'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"

/** Escapes text for HTML. Every dynamic value goes through this. */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Raw HTML that is already safe: the output of the helpers below. */
export interface Html { readonly html: string }
const raw = (html: string): Html => ({ html })
const join = (parts: (Html | null | undefined | false)[]) => parts.filter(Boolean).map(p => (p as Html).html).join('')

export function eyebrow(text: string): Html {
  return raw(`<p class="gz-accent" style="margin:0 0 10px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:${C.accent}">${esc(text)}</p>`)
}

export function heading(text: string, size: 'large' | 'small' = 'large'): Html {
  const style = size === 'large'
    ? 'margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em'
    : 'margin:0 0 10px;font-size:18px;line-height:1.3;font-weight:650;letter-spacing:-0.01em'
  return raw(`<h1 class="gz-ink" style="${style};color:${C.ink}">${esc(text)}</h1>`)
}

export function paragraph(text: string, tone: 'copy' | 'muted' = 'copy'): Html {
  const muted = tone === 'muted'
  return raw(`<p class="${muted ? 'gz-muted' : 'gz-copy'}" style="margin:0 0 14px;font-size:${muted ? 14 : 16}px;line-height:1.6;color:${muted ? C.muted : C.copy}">${esc(text)}</p>`)
}

/** Big one-time code, easy to read and to copy. Accepts a template token such as {{ .Token }}. */
export function code(token: string, opts: { trusted?: boolean } = {}): Html {
  const value = opts.trusted ? token : esc(token)
  return raw(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px"><tr><td class="gz-code" style="padding:18px 28px;border-radius:14px;background:${C.accentSoft};color:${C.accent};font-family:${MONO};font-size:34px;line-height:1;font-weight:700;letter-spacing:10px">${value}</td></tr></table>`)
}

/** A bulletproof button: works in Outlook too. `href` must be http(s) or mailto. */
export function button(href: string, label: string, opts: { trusted?: boolean } = {}): Html {
  if (!opts.trusted && !/^(https?:|mailto:)/i.test(href)) throw new Error(`Unsafe email link: ${href}`)
  const url = opts.trusted ? href : esc(href)
  return raw(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px"><tr><td class="gz-btn" style="border-radius:999px;background:${C.accent}"><a class="gz-btn-link" href="${url}" style="display:inline-block;padding:14px 26px;border-radius:999px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:${C.onAccent};text-decoration:none">${esc(label)}</a></td></tr></table>`)
}

/** A highlighted figure, such as a balance. */
export function stat(label: string, value: string, tone: 'accent' | 'warning' = 'accent'): Html {
  const [bg, fg] = tone === 'warning' ? [C.warningSoft, C.warning] : [C.accentSoft, C.accent]
  return raw(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 22px"><tr><td class="${tone === 'warning' ? 'gz-warn' : 'gz-stat'}" style="padding:18px 22px;border-radius:14px;background:${bg}"><p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${fg}">${esc(label)}</p><p style="margin:0;font-size:30px;line-height:1.1;font-weight:700;letter-spacing:-0.02em;color:${fg}">${esc(value)}</p></td></tr></table>`)
}

/** Label/value rows, such as a contact form submission. */
export function facts(rows: [string, string][]): Html {
  const body = rows.map(([label, value]) => `<tr><td class="gz-muted" width="96" style="width:96px;padding:9px 16px 9px 0;vertical-align:top;white-space:nowrap;font-size:14px;color:${C.muted}">${esc(label)}</td><td class="gz-ink" style="padding:9px 0;vertical-align:top;font-size:15px;color:${C.ink};word-break:break-word">${esc(value)}</td></tr>`).join('')
  return raw(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="gz-rule" style="margin:4px 0 18px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${body}</table>`)
}

/** Free text written by a person, keeping their line breaks. */
export function quote(text: string): Html {
  return raw(`<div class="gz-quote gz-ink" style="margin:0 0 22px;padding:16px 18px;border-radius:12px;background:${C.page};font-size:15px;line-height:1.6;color:${C.ink};white-space:pre-wrap;word-break:break-word">${esc(text)}</div>`)
}

export function divider(): Html {
  return raw(`<div class="gz-rule" style="height:1px;margin:10px 0 26px;background:${C.line};line-height:1px;font-size:1px">&nbsp;</div>`)
}

/** A block in one language, so screen readers and spell checkers switch voice. */
export function inLanguage(lang: 'ka' | 'en', parts: (Html | null | undefined | false)[]): Html {
  return raw(`<div lang="${lang}">${join(parts)}</div>`)
}

export interface EmailLayout {
  /** First line of the inbox preview. */
  preheader: string
  /** Main language of the email. */
  lang: 'ka' | 'en'
  title: string
  body: (Html | null | undefined | false)[]
  /** Small print under the card. */
  footer: string[]
  /** Site origin for footer links, or a template variable such as {{ .SiteURL }}. */
  siteUrl: string
}

export function renderEmail({ preheader, lang, title, body, footer, siteUrl }: EmailLayout): string {
  const site = siteUrl.replace(/\/$/, '')
  const footerLines = footer.map(line => `<p style="margin:0 0 6px">${esc(line)}</p>`).join('')
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(title)}</title>
<style>
  body { margin:0; padding:0; }
  a { color:${C.accent}; }
  @media (max-width:600px) {
    .gz-card { padding:28px 22px !important; border-radius:18px !important; }
    .gz-code { font-size:28px !important; letter-spacing:7px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .gz-page { background:#101313 !important; }
    .gz-card { background:#181d1a !important; }
    .gz-ink { color:#f0f4f1 !important; }
    .gz-copy { color:#c8d0ca !important; }
    .gz-muted, .gz-foot { color:#a5afa8 !important; }
    .gz-accent, .gz-foot a { color:#7ce1b0 !important; }
    .gz-code { background:#243e30 !important; color:#7ce1b0 !important; }
    .gz-stat { background:#243e30 !important; }
    .gz-stat p { color:#7ce1b0 !important; }
    .gz-warn { background:#3a2a12 !important; }
    .gz-warn p { color:#ffb35c !important; }
    .gz-btn { background:#7ce1b0 !important; }
    .gz-btn-link { color:#0b2719 !important; }
    .gz-quote { background:#101313 !important; }
    .gz-rule { border-color:#364139 !important; background:#364139 !important; }
    .gz-mark { background:#7ce1b0 !important; }
  }
</style>
</head>
<body class="gz-page" style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;</div>
<table role="presentation" class="gz-page" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;font-family:${FONT}">
    <tr><td style="padding:0 4px 18px">
      <a href="${site}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="width:26px"><div class="gz-mark" style="width:26px;height:14px;border-radius:4px;background:${C.accent};font-size:1px;line-height:14px">&nbsp;</div></td>
        <td class="gz-ink" style="padding-left:9px;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-0.03em;color:${C.ink}">gzad</td>
      </tr></table></a>
    </td></tr>
    <tr><td class="gz-card" style="padding:40px 40px 30px;border-radius:24px;background:${C.card}">
      ${join(body)}
    </td></tr>
    <tr><td class="gz-foot" style="padding:22px 8px 0;font-size:12px;line-height:1.6;color:${C.muted}">
      ${footerLines}
      <p style="margin:10px 0 0"><a href="${site}" style="color:${C.muted}">${SITE_NAME}</a> &nbsp;·&nbsp; <a href="${site}/privacy" style="color:${C.muted}">Privacy</a> &nbsp;·&nbsp; <a href="${site}/contact" style="color:${C.muted}">Contact</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`
}

/** The site's address as shown in emails. */
export const SITE_NAME = 'gzadvertisement.ge'

/** The company line every email ends with. */
export const COMPANY_FOOTER = 'Gzad · შპს „გზადვერთაისმენთ“ / Gzadvertisement LLC · Tbilisi, Georgia'
