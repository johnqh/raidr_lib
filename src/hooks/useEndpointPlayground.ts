/**
 * The endpoint playground: one endpoint's documentation, a form model for its
 * parameters, remembered credentials, and "Execute" through raidr's proxy.
 *
 * Errors are computed on every change but only meant to be shown for fields
 * the user has touched, or for all fields after an execute attempt
 * (`showAllErrors`). Credentials are remembered per API host in this browser
 * when `remember` is on (the default).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRaidrApiDoc, useRaidrExecuteApi } from '@sudobility/raidr_client';
import {
  type ApiDoc,
  type ApiEndpoint,
  type ApiExecuteResult,
  parseEndpointRef,
} from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import { buildExecute, validateParam } from '../utils/params';
import {
  createCredentialStore,
  type CredentialStore,
  openLoginWindow,
} from '../utils/credentials';

export interface UseEndpointPlaygroundOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  /** The `endpoint` link parameter: `METHOD https://host/path`. */
  endpointRef: string;
  isAuthenticated: boolean;
  /** Injected in tests; defaults to localStorage. */
  credentialStore?: CredentialStore;
}

export interface UseEndpointPlaygroundResult {
  apiHost: string | null;
  doc: ApiDoc | null;
  endpoint: ApiEndpoint | null;
  /** Raw form text by parameter name. */
  values: Record<string, string>;
  setValue: (name: string, raw: string) => void;
  /** Raw JSON for extra body fields (endpoints with `additionalBody`). */
  extraBody: string;
  setExtraBody: (text: string) => void;
  /** Errors by parameter name (and `extraBody`), for every field. */
  errors: Record<string, string>;
  /** Fields the user changed; show their errors. */
  touched: Record<string, boolean>;
  /** After an execute attempt, show every error. */
  showAllErrors: boolean;
  userToken: string;
  setUserToken: (token: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  remember: boolean;
  setRemember: (on: boolean) => void;
  /** Open the site's sign-in page in a popup; false when no login URL or the popup was blocked. */
  openLogin: () => boolean;
  /** The endpoint needs a credential the user has not entered. */
  missingCredential: 'user' | 'api_key' | null;
  execute: () => void;
  isExecuting: boolean;
  result: ApiExecuteResult | null;
  executeError: Error | null;
  reset: () => void;
  requiresSignIn: boolean;
  isLoading: boolean;
  /** The reference is malformed, or the host or endpoint does not exist. */
  notFound: boolean;
  error: Error | null;
}

export function useEndpointPlayground(
  options: UseEndpointPlaygroundOptions
): UseEndpointPlaygroundResult {
  const { networkClient, baseUrl, isAuthenticated } = options;
  const parsed = useMemo(
    () => parseEndpointRef(options.endpointRef),
    [options.endpointRef]
  );
  const apiHost = parsed?.apiHost ?? '';
  const store = useMemo(
    () => options.credentialStore ?? createCredentialStore(),
    [options.credentialStore]
  );

  const docQuery = useRaidrApiDoc(networkClient, baseUrl, apiHost, {
    enabled: isAuthenticated,
    retry: false,
  });
  const mutation = useRaidrExecuteApi(networkClient, baseUrl);
  const doc = (docQuery.data?.success ? docQuery.data.data?.doc : null) ?? null;
  const endpoint = useMemo(
    () =>
      doc?.endpoints.find(
        e => e.method === parsed?.method && e.path === parsed?.path
      ) ?? null,
    [doc, parsed]
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [extraBody, setExtraBodyState] = useState('');
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [remember, setRemember] = useState(true);
  const [userToken, setUserTokenState] = useState('');
  const [apiKey, setApiKeyState] = useState('');

  // Load remembered credentials when the host is known.
  useEffect(() => {
    if (!apiHost) return;
    setUserTokenState(store.get(apiHost, 'user') ?? '');
    setApiKeyState(store.get(apiHost, 'api_key') ?? '');
  }, [apiHost, store]);

  // A different endpoint starts from a clean form.
  useEffect(() => {
    setValues({});
    setTouched({});
    setExtraBodyState('');
    setShowAllErrors(false);
    mutation.reset();
  }, [endpoint?.id]);

  const setValue = useCallback((name: string, raw: string) => {
    setValues(v => ({ ...v, [name]: raw }));
    setTouched(t => ({ ...t, [name]: true }));
  }, []);
  const setExtraBody = useCallback((text: string) => {
    setExtraBodyState(text);
    setTouched(t => ({ ...t, extraBody: true }));
  }, []);
  const setUserToken = useCallback(
    (token: string) => {
      setUserTokenState(token);
      if (!apiHost) return;
      if (remember) store.set(apiHost, 'user', token);
      else store.clear(apiHost, 'user');
    },
    [apiHost, remember, store]
  );
  const setApiKey = useCallback(
    (key: string) => {
      setApiKeyState(key);
      if (!apiHost) return;
      if (remember) store.set(apiHost, 'api_key', key);
      else store.clear(apiHost, 'api_key');
    },
    [apiHost, remember, store]
  );
  const setRememberAndApply = useCallback(
    (on: boolean) => {
      setRemember(on);
      if (!apiHost) return;
      if (on) {
        store.set(apiHost, 'user', userToken);
        store.set(apiHost, 'api_key', apiKey);
      } else {
        store.clear(apiHost, 'user');
        store.clear(apiHost, 'api_key');
      }
    },
    [apiHost, store, userToken, apiKey]
  );

  const errors = useMemo(() => {
    if (!endpoint) return {};
    const out: Record<string, string> = {};
    for (const param of endpoint.params) {
      const error = validateParam(param, values[param.name] ?? '');
      if (error) out[param.name] = error;
    }
    return {
      ...out,
      ...buildExecute({ ...endpoint, params: [] }, {}, extraBody, {}).errors,
    };
  }, [endpoint, values, extraBody]);

  const missingCredential =
    endpoint?.auth === 'user' && !userToken
      ? 'user'
      : endpoint?.auth === 'api_key' && !apiKey
        ? 'api_key'
        : null;

  const execute = useCallback(() => {
    if (!endpoint || !apiHost) return;
    setShowAllErrors(true);
    const built = buildExecute(endpoint, values, extraBody, {
      userToken,
      apiKey,
    });
    if (!built.request) return;
    mutation.mutate({ apiHost, data: built.request });
  }, [endpoint, apiHost, values, extraBody, userToken, apiKey, mutation]);

  const reset = useCallback(() => {
    setValues({});
    setTouched({});
    setExtraBodyState('');
    setShowAllErrors(false);
    mutation.reset();
  }, [mutation]);

  const loginUrl = doc?.auth.user?.loginUrl ?? doc?.siteOrigins[0] ?? null;
  const openLogin = useCallback(
    () => (loginUrl ? openLoginWindow(loginUrl) !== null : false),
    [loginUrl]
  );

  const docMissing =
    isAuthenticated &&
    !docQuery.isLoading &&
    ((docQuery.error as { status?: number } | null)?.status === 404 ||
      (docQuery.data && !docQuery.data.success));
  const notFound = !parsed || docMissing === true || (!!doc && !endpoint);
  const fetchError =
    docQuery.error && (docQuery.error as { status?: number }).status !== 404
      ? (docQuery.error as Error)
      : null;
  const executeError =
    (mutation.error as Error | null) ??
    (mutation.data && !mutation.data.success
      ? new Error(mutation.data.error ?? 'Request failed')
      : null);

  return {
    apiHost: parsed?.apiHost ?? null,
    doc,
    endpoint,
    values,
    setValue,
    extraBody,
    setExtraBody,
    errors,
    touched,
    showAllErrors,
    userToken,
    setUserToken,
    apiKey,
    setApiKey,
    remember,
    setRemember: setRememberAndApply,
    openLogin,
    missingCredential,
    execute,
    isExecuting: mutation.isPending,
    result: mutation.data?.success ? (mutation.data.data ?? null) : null,
    executeError,
    reset,
    requiresSignIn: !isAuthenticated,
    isLoading: isAuthenticated && docQuery.isLoading,
    notFound,
    error: fetchError,
  };
}
