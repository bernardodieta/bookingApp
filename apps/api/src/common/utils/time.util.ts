import { BadRequestException } from '@nestjs/common';

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function assertValidTime(value: string, fieldName: string) {
  if (!HHMM_REGEX.test(value)) {
    throw new BadRequestException(`${fieldName} debe tener formato HH:mm.`);
  }
}

export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesFromDate(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}
