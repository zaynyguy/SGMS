import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PrivateRoute({ children }) {
  const { token } = useAuth(); // read token from Context
  return token ? children : <Navigate to="/login" replace />;
}
