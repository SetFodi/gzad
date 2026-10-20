import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import tls, { type TLSSocket } from 'node:tls'
import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { billingMailProvider } from './billing-mail'

const mail = { from: 'Gzad <sender@example.invalid>', to: ['client@example.invalid'], subject: 'Balance notice', text: 'Local SMTP verification only' }
let fixtureDir: string
let cert: Buffer
let key: Buffer
const servers: tls.Server[] = []
const sockets = new Set<TLSSocket>()

beforeAll(() => {
  fixtureDir = mkdtempSync(path.join(tmpdir(), 'gzad-smtp-wire-'))
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(fixtureDir, 'key.pem'),
    '-out', path.join(fixtureDir, 'cert.pem'), '-subj', '/CN=localhost', '-days', '1', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' })
  cert = readFileSync(path.join(fixtureDir, 'cert.pem'))
  key = readFileSync(path.join(fixtureDir, 'key.pem'))
})
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals()
  for (const socket of sockets) socket.destroy()
  sockets.clear()
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }))

function configured(port = '465') {
  vi.stubEnv('BILLING_EMAIL_PROVIDER', 'smtp')
  vi.stubEnv('BILLING_SMTP_HOST', 'smtp.gmail.com')
  vi.stubEnv('BILLING_SMTP_PORT', port)
  vi.stubEnv('BILLING_SMTP_USER', 'sender@example.invalid')
  vi.stubEnv('BILLING_SMTP_PASS', 'local-test-password')
}

async function smtpServer(mode: 'accept' | 'reject-recipient' | 'lose-acceptance') {
  const messages: string[] = []
  const commands: string[] = []
  const server = tls.createServer({ key, cert }, socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    socket.setEncoding('utf8')
    socket.write('220 localhost ESMTP\r\n')
    let buffer = ''
    let data = false
    socket.on('data', (chunk: string) => {
      buffer += chunk
      while (buffer.includes('\r\n')) {
        if (data) {
          const end = buffer.indexOf('\r\n.\r\n')
          if (end < 0) return
          messages.push(buffer.slice(0, end))
          buffer = buffer.slice(end + 5)
          data = false
          if (mode === 'lose-acceptance') { socket.destroy(); return }
          socket.write('250 2.0.0 queued-local\r\n')
          continue
        }
        const end = buffer.indexOf('\r\n')
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const command = line.split(' ')[0]
        commands.push(command)
        if (command === 'EHLO' || command === 'HELO') socket.write('250-localhost\r\n250 AUTH PLAIN\r\n')
        else if (command === 'AUTH') socket.write('235 2.7.0 authenticated\r\n')
        else if (command === 'MAIL') socket.write('250 2.1.0 sender ok\r\n')
        else if (command === 'RCPT') socket.write(mode === 'reject-recipient' ? '550 5.1.1 recipient rejected\r\n' : '250 2.1.5 recipient ok\r\n')
        else if (command === 'DATA') { data = true; socket.write('354 send message\r\n') }
        else if (command === 'QUIT') { socket.end('221 closing\r\n'); return }
        else socket.write('250 ok\r\n')
      }
    })
  })
  servers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('SMTP fixture has no TCP port')
  const original = nodemailer.createTransport.bind(nodemailer)
  const transport = vi.spyOn(nodemailer, 'createTransport').mockImplementation(options => original({
    ...options as SMTPTransport.Options,
    host: '127.0.0.1', port: address.port,
    // Trust only this fixture certificate; certificate validation remains on.
    tls: { ...(options as SMTPTransport.Options).tls, ca: cert, servername: 'localhost' },
  }))
  return { messages, commands, transport }
}

describe('billing SMTP provider over a real local TLS connection', () => {
  it('rejects a fixture listen error immediately', async () => {
    vi.spyOn(tls.Server.prototype, 'listen').mockImplementation(function (this: tls.Server) {
      queueMicrotask(() => this.emit('error', new Error('local listen failure')))
      return this
    })
    await expect(smtpServer('accept')).rejects.toThrow('local listen failure')
  })

  it('requires encrypted SMTP configuration', () => {
    configured('25')
    expect(() => billingMailProvider()).toThrow('465 or 587')
  })

  it('requires STARTTLS on port 587 and keeps certificate validation enabled', () => {
    configured('587')
    const spy = vi.spyOn(nodemailer, 'createTransport')
    billingMailProvider()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      port: 587, secure: false, requireTLS: true,
      tls: expect.objectContaining({ rejectUnauthorized: true, minVersion: 'TLSv1.2' }),
      logger: false, debug: false,
    }))
  })

  it('records SMTP acceptance and uses a stable message ID', async () => {
    configured()
    const fixture = await smtpServer('accept')
    const result = await billingMailProvider().send(mail, 'local-alert')
    expect(result).toEqual({ providerId: '<billing-alert.local-alert@gzad.local>', error: null, retrySafe: false })
    expect(fixture.messages).toHaveLength(1)
    expect(fixture.messages[0]).toContain('Message-ID: <billing-alert.local-alert@gzad.local>')
    expect(fixture.transport).toHaveBeenCalledWith(expect.objectContaining({
      port: 465, secure: true, requireTLS: true,
      tls: expect.objectContaining({ rejectUnauthorized: true }),
    }))
  })

  it('allows retry for an explicit recipient rejection before DATA', async () => {
    configured()
    const fixture = await smtpServer('reject-recipient')
    const result = await billingMailProvider().send(mail, 'rejected-alert')
    expect(result).toEqual({ providerId: null, error: 'SMTP EENVELOPE 550', retrySafe: true })
    expect(fixture.messages).toHaveLength(0)
    expect(fixture.commands).not.toContain('DATA')
  })

  it('blocks retry when the connection closes after DATA without its final reply', async () => {
    configured()
    const fixture = await smtpServer('lose-acceptance')
    const result = await billingMailProvider().send(mail, 'uncertain-alert')
    expect(result).toEqual({ providerId: null, error: 'SMTP ECONNECTION; delivery uncertain, manual review required', retrySafe: false })
    expect(fixture.messages).toHaveLength(1)
  })
})
