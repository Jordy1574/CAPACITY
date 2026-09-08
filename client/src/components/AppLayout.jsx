import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <>
      <Header />
      <div className="app-layout">
        <Sidebar />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </>
  );
}
