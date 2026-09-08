import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

function fillDemo(setEmail, setPassword, email) {
  setEmail(email);
  setPassword('123456');
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/capacity" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/capacity');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block">
            <h1 className="font-brand text-4xl tracking-tight font-black text-black inline-block">
              biss<span className="text-[#D81B60]">ú</span>
            </h1>
            <span className="block text-xs font-bold tracking-widest text-gray-500 uppercase mt-1">ACCESORIOS</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-pink-50 border border-pink-100 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#D81B60]"></span>
            <span className="text-xs font-semibold text-[#D81B60] tracking-wide uppercase">Capacity System</span>
          </div>
        </div>

        <div className="antigravity-card p-8 bg-white/90">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 font-brand">Bienvenido de nuevo</h2>
          <p className="text-sm text-gray-500 mb-6">
            Ingresa con tus credenciales corporativas para gestionar la asistencia de tienda.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Correo Corporativo
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej. bissujesusmaria@bissu.pe"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#D81B60] focus:border-transparent outline-none transition-all text-sm bg-white"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#D81B60] focus:border-transparent outline-none transition-all text-sm bg-white"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 btn-bissu flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-bold"
            >
              <span>{loading ? 'Verificando...' : 'Ingresar a la Plataforma'}</span>
              {!loading && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-3">Acceso Rápido de Demo</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo(setEmail, setPassword, 'bissujesusmaria@bissu.pe')}
                className="px-3 py-2 text-xs bg-gray-50 hover:bg-pink-50 hover:text-[#D81B60] border border-gray-200 rounded-lg text-gray-600 transition-all font-medium text-center"
              >
                Tienda Jesús María
              </button>
              <button
                type="button"
                onClick={() => fillDemo(setEmail, setPassword, 'admin@bissu.pe')}
                className="px-3 py-2 text-xs bg-gray-50 hover:bg-pink-50 hover:text-[#D81B60] border border-gray-200 rounded-lg text-gray-600 transition-all font-medium text-center"
              >
                Administrador Global
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
