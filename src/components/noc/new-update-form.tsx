'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Send, Loader2, Pin } from 'lucide-react'
import { PRIORITY_META, CATEGORY_META } from '@/lib/noc-types'
import type { Priority, Category, NocUpdate } from '@/lib/noc-types'

interface NewUpdateFormProps {
  onCreated: (update: NocUpdate) => void
}

const EXPIRY_PRESETS: { label: string; minutes: number | null }[] = [
  { label: 'No expiry', minutes: null },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
  { label: '24 hours', minutes: 1440 },
]

export function NewUpdateForm({ onCreated }: NewUpdateFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('info')
  const [category, setCategory] = useState<Category>('general')
  const [authorName, setAuthorName] = useState('NOC Operator')
  const [source, setSource] = useState('NOC')
  const [expiryMinutes, setExpiryMinutes] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync authorName with logged-in user (best-effort, once on mount)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.name) setAuthorName(data.user.name)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/noc/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          priority,
          category,
          authorName: authorName.trim() || 'NOC Operator',
          source: source.trim() || null,
          expiresInMinutes: expiryMinutes,
          pinned: priority === 'critical' && pinned,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to post update')
      }
      const data = await res.json()
      setTitle('')
      setContent('')
      setPriority('info')
      setCategory('general')
      setExpiryMinutes(null)
      setPinned(false)
      onCreated(data.update as NocUpdate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post update')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Plus className="h-5 w-5 text-slate-700" />
          Post New Update
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Production API latency spike in us-east-1"
              maxLength={140}
              className="border-slate-200 focus-visible:ring-slate-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content" className="text-sm font-medium text-slate-700">
              Content <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide a concise description, impact, and any actions being taken. This text will be shown on the TV wall."
              rows={4}
              maxLength={800}
              className="resize-none border-slate-200 focus-visible:ring-slate-400"
              required
            />
            <p className="text-right text-xs text-slate-400">{content.length}/800</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PRIORITY_META[p].accent }}
                        />
                        {PRIORITY_META[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="author" className="text-sm font-medium text-slate-700">
                Author
              </Label>
              <Input
                id="author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={60}
                className="border-slate-200 focus-visible:ring-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source" className="text-sm font-medium text-slate-700">
                Source
              </Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                maxLength={40}
                placeholder="NOC, On-call, ..."
                className="border-slate-200 focus-visible:ring-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Auto-expire</Label>
              <Select
                value={expiryMinutes === null ? 'none' : String(expiryMinutes)}
                onValueChange={(v) => setExpiryMinutes(v === 'none' ? null : parseInt(v, 10))}
              >
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.minutes === null ? 'none' : String(p.minutes)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {priority === 'critical' && (
            <div className="flex items-center gap-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5">
              <Checkbox
                id="pinned"
                checked={pinned}
                onCheckedChange={(v) => setPinned(v === true)}
                className="border-violet-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
              />
              <Label htmlFor="pinned" className="flex-1 cursor-pointer text-sm text-violet-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <Pin className="h-3.5 w-3.5" />
                  Pin to top of wall
                </span>
                <span className="text-xs text-violet-600">
                  Critical updates only. Pinned updates stay at the top of the wall.
                </span>
              </Label>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-600"
                style={{
                  color: PRIORITY_META[priority].accent,
                  borderColor: PRIORITY_META[priority].accent,
                }}
              >
                {PRIORITY_META[priority].label}
              </Badge>
              <Badge variant="outline" className="border-slate-200 text-slate-600">
                {CATEGORY_META[category].label}
              </Badge>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post to Wall
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
