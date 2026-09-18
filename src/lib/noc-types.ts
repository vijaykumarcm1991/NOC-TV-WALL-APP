export type Priority = 'critical' | 'warning' | 'info' | 'success'
export type Category = 'incident' | 'maintenance' | 'announcement' | 'general'
export type UpdateStatus = 'active' | 'resolved' | 'expired'

export interface NocUpdate {
  id: string
  title: string
  content: string
  priority: Priority
  category: Category
  status: UpdateStatus
  authorName: string
  source: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  resolvedAt: string | null
}

export type WallEvent =
  | { type: 'update:created'; update: NocUpdate }
  | { type: 'update:resolved'; update: NocUpdate }
  | { type: 'update:deleted'; id: string }
  | { type: 'update:reactivated'; update: NocUpdate }
  | { type: 'wall:cleared' }
  | { type: 'wall:refresh' }

export const PRIORITY_META: Record<
  Priority,
  { label: string; accent: string; bg: string; border: string; text: string; dot: string; ring: string }
> = {
  critical: {
    label: 'Critical',
    accent: '#dc2626',
    bg: 'bg-red-950/40',
    border: 'border-red-500',
    text: 'text-red-300',
    dot: 'bg-red-500',
    ring: 'ring-red-500/40',
  },
  warning: {
    label: 'Warning',
    accent: '#f59e0b',
    bg: 'bg-amber-950/40',
    border: 'border-amber-500',
    text: 'text-amber-300',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/40',
  },
  info: {
    label: 'Info',
    accent: '#06b6d4',
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-500',
    text: 'text-cyan-300',
    dot: 'bg-cyan-500',
    ring: 'ring-cyan-500/40',
  },
  success: {
    label: 'Resolved',
    accent: '#10b981',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500',
    text: 'text-emerald-300',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/40',
  },
}

export const CATEGORY_META: Record<Category, { label: string }> = {
  incident: { label: 'Incident' },
  maintenance: { label: 'Maintenance' },
  announcement: { label: 'Announcement' },
  general: { label: 'General' },
}
