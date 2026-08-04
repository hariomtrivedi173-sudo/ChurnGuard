import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Customers', path: '/customers' },
  { label: 'Upload dataset', path: '/upload' },
  { label: 'Predictions', path: '/predict' },
]

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <div className="w-56 bg-white rounded-2xl shadow-sm p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-8 px-1">
        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
          C
        </div>
        <span className="font-bold text-gray-800">ChurnGuard</span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`text-left px-3 py-2 rounded-xl text-sm transition-colors duration-100 ease-out ${
              location.pathname === item.path
                ? 'bg-purple-100 text-purple-700 font-medium'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

<button
  onClick={handleLogout}
  className="mt-auto text-left px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-100 ease-out"
>
  Log out
</button>
    </div>
  )
}

export default Sidebar