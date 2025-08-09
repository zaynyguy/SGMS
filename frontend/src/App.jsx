import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Admin from "./pages/Admin";
import AuthProvider from './context/AuthContext';


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    // <Dashboard/>
  );
}
