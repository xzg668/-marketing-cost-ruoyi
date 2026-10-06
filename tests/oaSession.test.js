import test from 'node:test'
import assert from 'node:assert/strict'
import { browserKey, requestToken, safeEntryPath, OA_SESSION_KEY } from '../src/utils/oaSession.js'

const storage = values => ({ getItem: key => values[key] || null })
test('OA entry never uses existing admin login, including when OA session is missing', () => {
  const local = storage({ token: 'admin-token' })
  const session = storage({ [OA_SESSION_KEY]: JSON.stringify({ accessToken: 'oa-token' }) })
  assert.equal(requestToken('/collaboration/technical-data/forms/1', local, session), 'oa-token')
  assert.equal(requestToken('/collaboration/technical-data/forms/1', local, storage({})), '')
  assert.equal(requestToken('/system/users', local, session), 'admin-token')
  assert.equal(requestToken('/oa-login', local, storage({ [OA_SESSION_KEY]: 'broken' })), '')
})
test('handoff accepts only a local document workbench path', () => {
  assert.ok(safeEntryPath('/collaboration/technical-data/forms/12?submission=abc-123'))
  for (const value of ['https://evil.test', '//evil.test', '/system/users', '/collaboration/technical-data/forms/12?redirect=/admin']) {
    assert.equal(safeEntryPath(value), false)
  }
})
test('browser binding uses secure random bytes and works without secure-context crypto.subtle', () => {
  const value = browserKey({ getRandomValues: bytes => { bytes.fill(255); return bytes } })
  assert.match(value, /^[A-Za-z0-9_-]{43}$/)
})
