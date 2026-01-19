const getLocalDateFromStr = (dateString: string): Date => {
  if (!dateString) return new Date();
  // Split by T to ignore time, then by - to get components
  // "2026-01-18T..." -> "2026-01-18" -> [2026, 1, 18]
  const [y, m, d] = dateString.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

export const calculateDaysDiff = (dateString: string): number => {
  if (!dateString) return 0;

  const start = getLocalDateFromStr(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Time difference in milliseconds
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const calculateDaysUntil = (dateString: string): number => {
  if (!dateString) return 0;

  const target = getLocalDateFromStr(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = getLocalDateFromStr(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

// Threshold constants
export const THRESHOLD_IMPRISONMENT = 365;
export const THRESHOLD_REVIEW = 89; // > 89 days (90 day limit)

export const getStatusColor = (days: number, threshold: number, isCritical: boolean = false): string => {
  if (days > threshold) {
    return isCritical ? 'bg-red-100 text-red-800 font-bold border-red-200' : 'bg-orange-100 text-orange-800 font-medium border-orange-200';
  }
  return 'text-slate-600';
};