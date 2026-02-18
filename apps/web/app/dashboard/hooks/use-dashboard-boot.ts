import { useEffect } from 'react';
import type { ServiceItem, StaffMember } from '../dashboard-types';

type UseDashboardBootParams = {
  apiUrl: string;
  token: string;
  tokenStorageKey: string;
  apiUrlStorageKey: string;
  onMissingToken: () => void;

  staffId: string;
  quickBookingStaffId: string;
  quickRuleStaffId: string;
  quickExceptionStaffId: string;
  quickWaitlistStaffId: string;
  quickBookingServiceId: string;
  quickWaitlistServiceId: string;

  setToken: (value: string) => void;
  setApiUrl: (value: string) => void;
  setStaffLoading: (value: boolean) => void;
  setServiceLoading: (value: boolean) => void;
  setStaffError: (value: string) => void;
  setServiceError: (value: string) => void;
  setStaffOptions: (value: StaffMember[]) => void;
  setServiceOptions: (value: ServiceItem[]) => void;
  setStaffId: (value: string) => void;
  setQuickBookingStaffId: (value: string) => void;
  setQuickRuleStaffId: (value: string) => void;
  setQuickExceptionStaffId: (value: string) => void;
  setQuickWaitlistStaffId: (value: string) => void;
  setQuickBookingServiceId: (value: string) => void;
  setQuickWaitlistServiceId: (value: string) => void;
};

export function useDashboardBoot(params: UseDashboardBootParams) {
  const {
    apiUrl,
    token,
    tokenStorageKey,
    apiUrlStorageKey,
    onMissingToken,
    staffId,
    quickBookingStaffId,
    quickRuleStaffId,
    quickExceptionStaffId,
    quickWaitlistStaffId,
    quickBookingServiceId,
    quickWaitlistServiceId,
    setToken,
    setApiUrl,
    setStaffLoading,
    setServiceLoading,
    setStaffError,
    setServiceError,
    setStaffOptions,
    setServiceOptions,
    setStaffId,
    setQuickBookingStaffId,
    setQuickRuleStaffId,
    setQuickExceptionStaffId,
    setQuickWaitlistStaffId,
    setQuickBookingServiceId,
    setQuickWaitlistServiceId
  } = params;

  useEffect(() => {
    const storedToken = localStorage.getItem(tokenStorageKey);
    const storedApiUrl = localStorage.getItem(apiUrlStorageKey);

    if (!storedToken) {
      onMissingToken();
      return;
    }

    setToken(storedToken);
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
  }, [tokenStorageKey, apiUrlStorageKey, onMissingToken, setToken, setApiUrl]);

  useEffect(() => {
    const normalizedApiUrl = apiUrl.trim();
    try {
      new URL(normalizedApiUrl);
      localStorage.setItem(apiUrlStorageKey, normalizedApiUrl);
    } catch {
      return;
    }
  }, [apiUrl, apiUrlStorageKey]);

  useEffect(() => {
    if (!token.trim()) {
      return;
    }

    let cancelled = false;

    async function loadReferenceData() {
      setStaffLoading(true);
      setServiceLoading(true);
      setStaffError('');
      setServiceError('');

      try {
        const normalizedApiUrl = apiUrl.trim();
        try {
          new URL(normalizedApiUrl);
        } catch {
          setStaffError('API URL inválida.');
          setServiceError('API URL inválida.');
          return;
        }

        const [staffResponse, servicesResponse] = await Promise.all([
          fetch(new URL('/staff', normalizedApiUrl).toString(), {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }),
          fetch(new URL('/services', normalizedApiUrl).toString(), {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ]);

        if (!staffResponse.ok) {
          const text = await staffResponse.text();
          throw new Error(text || `Error ${staffResponse.status}`);
        }

        if (!servicesResponse.ok) {
          const text = await servicesResponse.text();
          throw new Error(text || `Error ${servicesResponse.status}`);
        }

        const staffPayload = (await staffResponse.json()) as StaffMember[];
        const servicesPayload = (await servicesResponse.json()) as ServiceItem[];
        if (cancelled) {
          return;
        }

        setStaffOptions(staffPayload);
        setServiceOptions(servicesPayload);

        if (staffPayload.length && !staffPayload.some((entry) => entry.id === staffId)) {
          setStaffId('');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickBookingStaffId)) {
          setQuickBookingStaffId(staffPayload[0]?.id ?? '');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickRuleStaffId)) {
          setQuickRuleStaffId(staffPayload[0]?.id ?? '');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickExceptionStaffId)) {
          setQuickExceptionStaffId(staffPayload[0]?.id ?? '');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickWaitlistStaffId)) {
          setQuickWaitlistStaffId(staffPayload[0]?.id ?? '');
        }

        if (servicesPayload.length && !servicesPayload.some((entry) => entry.id === quickBookingServiceId)) {
          setQuickBookingServiceId(servicesPayload[0]?.id ?? '');
        }
        if (servicesPayload.length && !servicesPayload.some((entry) => entry.id === quickWaitlistServiceId)) {
          setQuickWaitlistServiceId(servicesPayload[0]?.id ?? '');
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar staff';
        setStaffError(message);
        setServiceError(message);
      } finally {
        if (!cancelled) {
          setStaffLoading(false);
          setServiceLoading(false);
        }
      }
    }

    void loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [
    apiUrl,
    token,
    staffId,
    quickBookingStaffId,
    quickRuleStaffId,
    quickExceptionStaffId,
    quickWaitlistStaffId,
    quickBookingServiceId,
    quickWaitlistServiceId,
    setStaffLoading,
    setServiceLoading,
    setStaffError,
    setServiceError,
    setStaffOptions,
    setServiceOptions,
    setStaffId,
    setQuickBookingStaffId,
    setQuickRuleStaffId,
    setQuickExceptionStaffId,
    setQuickWaitlistStaffId,
    setQuickBookingServiceId,
    setQuickWaitlistServiceId
  ]);
}
