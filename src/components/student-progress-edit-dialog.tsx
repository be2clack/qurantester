'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertTriangle } from 'lucide-react'
import { StageNumber } from '@prisma/client'

interface ActiveTaskInfo {
  id: string
  stage: string
  passedCount: number
  requiredCount: number
  pageNumber: number
  startLine: number
  endLine: number
}

interface StudentProgressEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    firstName: string | null
    lastName: string | null
    currentPage: number
    currentLine: number
    currentStage: StageNumber | string
  } | null
  groupId?: string
  defaultRepetitionCount?: number
  onSuccess: () => void
}

const STAGES = [
  { value: 'STAGE_1_1', label: 'Этап 1.1 (изучение строк 1-7)' },
  { value: 'STAGE_1_2', label: 'Этап 1.2 (соединение 1-7)' },
  { value: 'STAGE_2_1', label: 'Этап 2.1 (изучение строк 8-15)' },
  { value: 'STAGE_2_2', label: 'Этап 2.2 (соединение 8-15)' },
  { value: 'STAGE_3', label: 'Этап 3 (вся страница)' },
]

/**
 * Auto-determine stage based on line number
 * Lines 1-7: STAGE_1_1 (learning individual lines in first half)
 * Lines 8-15: STAGE_2_1 (learning individual lines in second half)
 */
function getStageFromLine(lineNumber: number): string {
  if (lineNumber >= 1 && lineNumber <= 7) {
    return 'STAGE_1_1'
  } else if (lineNumber >= 8 && lineNumber <= 15) {
    return 'STAGE_2_1'
  }
  return 'STAGE_1_1'
}

export function StudentProgressEditDialog({
  open,
  onOpenChange,
  student,
  groupId,
  defaultRepetitionCount = 80,
  onSuccess,
}: StudentProgressEditDialogProps) {
  const [page, setPage] = useState(student?.currentPage || 1)
  const [line, setLine] = useState(student?.currentLine || 1)
  const [stage, setStage] = useState(student?.currentStage || 'STAGE_1_1')
  const [autoStage, setAutoStage] = useState(true) // Auto-determine stage from line
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTask, setActiveTask] = useState<ActiveTaskInfo | null>(null)
  const [loadingTask, setLoadingTask] = useState(false)

  // Fetch active task info when dialog opens
  useEffect(() => {
    if (open && student && groupId) {
      setLoadingTask(true)
      fetch(`/api/users/${student.id}/active-task?groupId=${groupId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setActiveTask(data?.task || null))
        .catch(() => setActiveTask(null))
        .finally(() => setLoadingTask(false))
    }
  }, [open, student, groupId])

  // Update state when student changes
  useEffect(() => {
    if (student) {
      setPage(student.currentPage)
      setLine(student.currentLine)
      setStage(student.currentStage)
      setAutoStage(true)
    }
  }, [student])

  // Auto-update stage when line changes (if autoStage is enabled)
  const handleLineChange = (newLine: number) => {
    setLine(newLine)
    if (autoStage) {
      setStage(getStageFromLine(newLine))
    }
  }

  // When stage is manually changed, disable autoStage
  const handleStageChange = (newStage: string) => {
    setStage(newStage)
    setAutoStage(false)
  }

  const handleSave = async () => {
    if (!student) return

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/users/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPage: page,
          currentLine: line,
          currentStage: stage,
          groupId: groupId, // Pass groupId to update specific StudentGroup
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Студент'
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редактировать прогресс</DialogTitle>
          <DialogDescription>
            {studentName}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {activeTask && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  У студента есть незавершённое задание!
                </p>
                <p className="text-muted-foreground mt-1">
                  Стр. {activeTask.pageNumber}, {activeTask.stage.replace('STAGE_', 'Этап ').replace('_', '.')}
                  {' '}— сдано {activeTask.passedCount}/{activeTask.requiredCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Изменение прогресса отменит это задание. Прогресс будет потерян.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="page">Страница</Label>
              <Input
                id="page"
                type="number"
                min={1}
                max={602}
                value={page}
                onChange={(e) => setPage(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line">Строка</Label>
              <Input
                id="line"
                type="number"
                min={1}
                max={15}
                value={line}
                onChange={(e) => handleLineChange(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">
              Этап {autoStage && <span className="text-xs text-muted-foreground">(авто)</span>}
            </Label>
            <Select value={stage} onValueChange={handleStageChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите этап" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
