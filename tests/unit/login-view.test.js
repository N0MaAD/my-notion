import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginView from '../../src/views/LoginView.vue'

const mocks = vi.hoisted(() => ({
  loginWithGoogle: vi.fn()
}))

vi.mock('../../src/stores/auth.js', () => ({
  useAuthStore: () => ({
    loginWithGoogle: mocks.loginWithGoogle
  })
}))

describe('LoginView', () => {
  afterEach(() => {
    mocks.loginWithGoogle.mockReset()
  })

  it('renders a named Google login button and remember-me checkbox', () => {
    const wrapper = mount(LoginView)

    const button = wrapper.get('button.btn-google')
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toContain('Se connecter avec Google')
    expect(wrapper.get('input[type="checkbox"]').element.checked).toBe(true)
    expect(wrapper.text()).toContain('Rester connecte')
  })

  it('passes the remember-me choice to the auth store', async () => {
    mocks.loginWithGoogle.mockResolvedValueOnce()
    const wrapper = mount(LoginView)

    await wrapper.get('input[type="checkbox"]').setValue(false)
    await wrapper.get('button.btn-google').trigger('click')

    expect(mocks.loginWithGoogle).toHaveBeenCalledWith(false)
  })
})
