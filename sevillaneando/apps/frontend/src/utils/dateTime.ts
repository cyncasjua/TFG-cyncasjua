import dayjs from 'dayjs';

export const formatDateTime = (value: string): string =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '';

export const updateDateKeepingTime = (currentValue: string, pickedDate: Date): string => {
  const prev = currentValue ? dayjs(currentValue) : dayjs();
  return dayjs(pickedDate).hour(prev.hour()).minute(prev.minute()).format('YYYY-MM-DD HH:mm');
};

export const updateTimeKeepingDate = (currentValue: string, pickedTime: Date): string => {
  const prev = currentValue ? dayjs(currentValue) : dayjs();
  return prev.hour(dayjs(pickedTime).hour()).minute(dayjs(pickedTime).minute()).format('YYYY-MM-DD HH:mm');
};
