import type { Individual } from '../types';

type OrderForm = Partial<Individual> & { order_drafts?: Record<string, string>; separate_order?: boolean };

export function orderValue(form: OrderForm, parent?: string): string {
  return parent ? form.order_drafts?.[parent] ?? String(form.child_order?.[parent]?.position ?? '') : '';
}

export function sharedOrderValue(form: OrderForm): string {
  return orderValue(form, form.father_id) || orderValue(form, form.mother_id);
}

export function usesSeparateOrder(form: OrderForm): boolean {
  if (form.separate_order !== undefined) return form.separate_order;
  return !!(form.father_id && form.mother_id && form.child_order?.[form.father_id]?.position !== form.child_order?.[form.mother_id]?.position);
}

export function orderUpdates(form: OrderForm): [string, string][] {
  const parents = [...new Set([form.father_id, form.mother_id].filter((id): id is string => !!id))];
  return parents.flatMap(parent => {
    const value = usesSeparateOrder(form) ? orderValue(form, parent) : sharedOrderValue(form);
    const saved = String(form.child_order?.[parent]?.position ?? '');
    return value !== saved ? [[parent, value] as [string, string]] : [];
  });
}
