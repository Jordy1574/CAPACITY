import { useAuth } from '../auth/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="antigravity-header sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline">
            <span className="font-brand text-2xl font-black text-black">
              biss<span className="text-[#D81B60]">ú</span>
            </span>
            <span className="ml-2 px-2.5 py-0.5 text-xs font-bold bg-pink-100 text-[#D81B60] rounded-full uppercase tracking-wider">
              Capacity
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm">
            <div className="w-7 h-7 rounded-full bg-[#D81B60] text-white flex items-center justify-center font-bold text-xs">
              {(user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-xs font-bold text-gray-900 leading-tight">{user?.email}</p>
              <p className="text-[10px] text-gray-500 font-semibold uppercase">{user?.rol}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            title="Cerrar Sesión"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
