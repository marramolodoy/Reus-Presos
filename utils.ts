export const calculateDaysDiff = (dateString: string): number => {
  if (!dateString) return 0;
  const start = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
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