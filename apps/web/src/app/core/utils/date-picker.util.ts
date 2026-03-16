export function toIsoDateTime(value: Date | null): string {
  return value ? value.toISOString() : '';
}

export function fromIsoDateTime(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function toIsoDateOnly(value: Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromIsoDateOnly(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null;
}
