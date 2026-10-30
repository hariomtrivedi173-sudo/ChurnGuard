with open("frontend/src/pages/Settings.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add forgotPassword import
old_import = "import {\n  fetchProfile, updateProfile,\n  requestPasswordOtp, verifyPasswordOtp,\n  uploadProfilePhoto, deleteProfilePhoto\n} from '../api/profile'"
new_import = "import {\n  fetchProfile, updateProfile,\n  requestPasswordOtp, verifyPasswordOtp,\n  uploadProfilePhoto, deleteProfilePhoto\n} from '../api/profile'\nimport { forgotPassword } from '../api/auth'"

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("Replaced import")
else:
    print("Could not find old_import")

# 2. Add sendingForgotLink state and handleForgotCurrentPassword
old_state = "const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('')"
new_state = """const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('')
  const [sendingForgotLink,  setSendingForgotLink]  = useState(false)

  async function handleForgotCurrentPassword(e) {
    if (e) e.preventDefault()
    if (sendingForgotLink) return
    setSendingForgotLink(true)
    setPwError('')
    try {
      const emailToUse = profile?.email || ''
      if (!emailToUse) {
        window.location.href = '/login?forgot=1'
        return
      }
      await forgotPassword(emailToUse)
      toast.success('Password reset link sent to your email!')
      setPasswordSuccessMsg(`A password reset link has been dispatched to ${maskEmailHelper(emailToUse)}. Please check your inbox and spam folder.`)
    } catch (err) {
      toast.error(err.message || 'Could not send reset link right now.')
      setPwError(err.message || 'Could not send reset link right now.')
    } finally {
      setSendingForgotLink(false)
    }
  }"""

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("Replaced state")
else:
    print("Could not find old_state")

# 3. Add helper link under current password
target_pw_block = """                {passwordErrors.currentPassword && (
                  <p style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                    {passwordErrors.currentPassword}
                  </p>
                )}"""

replacement_pw_block = """                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  {passwordErrors.currentPassword ? (
                    <p style={{ fontSize: '11px', color: '#e11d48', margin: 0, fontWeight: 500 }}>
                      {passwordErrors.currentPassword}
                    </p>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={handleForgotCurrentPassword}
                    disabled={sendingForgotLink}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: '12px',
                      color: 'var(--brand)',
                      textDecoration: 'none',
                      fontWeight: 500,
                      cursor: sendingForgotLink ? 'not-allowed' : 'pointer',
                      opacity: sendingForgotLink ? 0.6 : 1
                    }}
                    onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.target.style.textDecoration = 'none'}
                  >
                    {sendingForgotLink ? 'Sending reset link…' : 'Forgot current password?'}
                  </button>
                </div>"""

if target_pw_block in content:
    content = content.replace(target_pw_block, replacement_pw_block, 1)
    print("Replaced current password block")
else:
    print("Could not find target_pw_block")

with open("frontend/src/pages/Settings.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done updating Settings.jsx")

