import * as dns from 'node:dns'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClaudeCompatProvider } from '../claude-compat'
import { CodexProvider } from '../codex'
import { assertPublicProviderHost } from '../ssrf-guard'
import type { CompletionOptions } from '../types'

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockSdk {
    messages = { stream: () => makeFakeStream(['x'], { input_tokens: 1, output_tokens: 1 }) }
  },
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: async function* (): AsyncIterable<unknown> { yield {} } } }
  },
}))

function makeFakeStream(parts: string[], usage: { input_tokens: number; output_tokens: number }) {
  const events = parts.map((text) => ({
    type: 'content_block_delta' as const,
    delta: { type: 'text_delta' as const, text },
  }))
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event
    },
    async finalMessage() {
      return { usage }
    },
  }
}

const opts = (prompt: string): CompletionOptions => ({
  model: 'm',
  messages: [{ role: 'user', content: prompt }],
})

describe('assertPublicProviderHost (DNS rebind revalidation)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes when DNS resolves to a public IP', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '8.8.8.8', family: 4 })
    await expect(assertPublicProviderHost('https://api.example.com/v1')).resolves.toBeUndefined()
  })

  it('rejects when DNS resolves to loopback 127.0.0.1 (rebind)', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '127.0.0.1', family: 4 })
    await expect(assertPublicProviderHost('https://api.example.com/v1')).rejects.toThrow(/SSRF/)
  })

  it('rejects when DNS resolves to cloud metadata 169.254.169.254', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '169.254.169.254', family: 4 })
    await expect(assertPublicProviderHost('https://rebind.example.com/v1')).rejects.toThrow(/SSRF/)
  })

  it('rejects when DNS resolves to private 10.x', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '10.0.0.5', family: 4 })
    await expect(assertPublicProviderHost('https://internal.example.com/v1')).rejects.toThrow(/SSRF/)
  })

  it('skips DNS lookup for literal loopback hostnames (localhost) — allowed for dev', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup')
    await expect(assertPublicProviderHost('http://localhost:11434/v1')).resolves.toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('skips DNS lookup for literal IP hostnames (already validated at config time)', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup')
    await expect(assertPublicProviderHost('https://8.8.8.8/v1')).resolves.toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('treats DNS lookup failure as non-fatal (resolves to pass) — avoids DoS via NXDOMAIN', async () => {
    vi.spyOn(dns.promises, 'lookup').mockRejectedValue(new Error('ENOTFOUND'))
    await expect(assertPublicProviderHost('https://unknown.example.com/v1')).resolves.toBeUndefined()
  })
})

describe('ClaudeCompatProvider — SSRF rebind rejection at query time', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects first query when custom baseUrl host resolves to private IP', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '169.254.169.254', family: 4 })
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://rebind.example.com/v1' })
    await expect(async () => {
      for await (const _chunk of provider.query(opts('hi'))) void _chunk
    }).rejects.toThrow(/SSRF/)
  })

  it('allows query when custom baseUrl host resolves to public IP', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '8.8.8.8', family: 4 })
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://api.example.com/v1' })
    const chunks = []
    for await (const chunk of provider.query(opts('hi'))) chunks.push(chunk)
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('performs DNS check only once across multiple queries', async () => {
    const spy = vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '8.8.8.8', family: 4 })
    const provider = new ClaudeCompatProvider('key', { baseUrl: 'https://api.example.com/v1' })
    for await (const _c of provider.query(opts('a'))) void _c
    for await (const _c of provider.query(opts('b'))) void _c
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('CodexProvider — SSRF rebind rejection at query time', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects first query when custom baseURL host resolves to private IP', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '10.0.0.5', family: 4 })
    const provider = new CodexProvider('key', 'https://rebind.example.com/v1')
    await expect(async () => {
      for await (const _chunk of provider.query(opts('hi'))) void _chunk
    }).rejects.toThrow(/SSRF/)
  })
})
