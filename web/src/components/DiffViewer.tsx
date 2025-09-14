import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, FileText, GitCompare } from 'lucide-react'

interface DiffViewerProps {
  isOpen: boolean
  onClose: () => void
  oldContent: string
  newContent: string
  title?: string
}

export function DiffViewer({ isOpen, onClose, oldContent, newContent, title = "Content Changes" }: DiffViewerProps) {
  const [showLineNumbers, setShowLineNumbers] = useState(true)

  // Simple word-based diff implementation
  const calculateDiff = () => {
    const oldWords = oldContent.split(/(\s+)/)
    const newWords = newContent.split(/(\s+)/)

    const changes = []
    let i = 0, j = 0

    while (i < oldWords.length || j < newWords.length) {
      if (i < oldWords.length && j < newWords.length && oldWords[i] === newWords[j]) {
        changes.push({ type: 'unchanged', value: oldWords[i] })
        i++
        j++
      } else if (j < newWords.length && (i >= oldWords.length || !oldWords.slice(i).some(word => newWords.slice(j).includes(word)))) {
        changes.push({ type: 'added', value: newWords[j] })
        j++
      } else if (i < oldWords.length) {
        changes.push({ type: 'removed', value: oldWords[i] })
        i++
      } else {
        changes.push({ type: 'added', value: newWords[j] })
        j++
      }
    }

    return changes
  }

  const diffChanges = calculateDiff()

  const renderDiffContent = () => {
    return diffChanges.map((change, index) => {
      let className = ''
      if (change.type === 'added') className = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      else if (change.type === 'removed') className = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 line-through'
      else className = 'text-gray-700 dark:text-gray-300'

      return (
        <span key={index} className={className}>
          {change.value}
        </span>
      )
    })
  }

  const calculateStats = () => {
    const added = diffChanges.filter(c => c.type === 'added').length
    const removed = diffChanges.filter(c => c.type === 'removed').length
    const unchanged = diffChanges.filter(c => c.type === 'unchanged').length

    return { added, removed, unchanged, total: diffChanges.length }
  }

  const stats = calculateStats()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            View changes between original and revised content
          </DialogDescription>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded"></span>
              Added: {stats.added} words
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded"></span>
              Removed: {stats.removed} words
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-gray-400 rounded"></span>
              Unchanged: {stats.unchanged} words
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
            >
              {showLineNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showLineNumbers ? 'Hide Numbers' : 'Show Numbers'}
            </Button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="space-y-4">
          {/* Old Content */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Original Content
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono text-sm whitespace-pre-wrap break-words">
              {oldContent || <em className="text-gray-500">No original content</em>}
            </div>
          </div>

          {/* New Content */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Revised Content
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono text-sm whitespace-pre-wrap break-words">
              {newContent || <em className="text-gray-500">No revised content</em>}
            </div>
          </div>

          {/* Inline Diff */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Inline Changes
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono text-sm whitespace-pre-wrap break-words">
              {renderDiffContent()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}