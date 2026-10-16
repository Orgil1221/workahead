import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export const AdminContext = createContext({ request: api, base: '/admin', preview: false });
export const useAdmin = () => useContext(AdminContext);
export const useAdminApi = () => useAdmin().request;
export function useAdminUser() {
  const context = useAdmin();
  const auth = useAuth();
  return context.preview ? context.user : auth.user;
}
export function AdminLink({ to, ...props }) {
  const { base } = useAdmin();
  return <Link {...props} to={to.replace(/^\/admin(?=\/|\?|$)/, base)} />;
}
export function useAdminLoad(path) {
  const request = useAdminApi();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let active = true;
    setState({ data: null, error: null, loading: true });
    request(path).then((data) => {
      if (active) setState({ data, error: null, loading: false });
    }).catch((error) => {
      if (active) setState({ data: null, error, loading: false });
    });
    return () => { active = false; };
  }, [request, path, revision]);
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
