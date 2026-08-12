const API_URL = "http://127.0.0.1:8000"

export async function loginUser(email, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || "Login failed")
  }

  return response.json()
}

export async function registerUser(email, password, profileData = {}) {
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      first_name: profileData.first_name || "",
      last_name:  profileData.last_name  || "",
      company:    profileData.company    || "",
      phone:      profileData.phone      || "",
      role:       profileData.role       || "Analyst",
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Registration failed (${response.status})`)
  }

  return response.json()
}