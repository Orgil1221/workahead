import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export const StudyContext = createContext({ request: api, base: '/student', preview: false });
export const useStudy = () => useContext(StudyContext);

export function useStudyLoad(loader, dependencies) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ data: null, error: null, loading: true });
    loader().then((data) => {
      if (active) setState({ data, error: null, loading: false });
    }).catch((error) => {
      if (active) setState({ data: null, error, loading: false });
    });
    return () => { active = false; };
  }, [...dependencies, revision]);
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
