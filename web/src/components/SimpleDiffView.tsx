interface SimpleDiffViewProps {
  oldContent: string
  newContent: string
}

export function SimpleDiffView({ oldContent, newContent }: SimpleDiffViewProps) {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const maxLines = Math.max(oldLines.length, newLines.length)

  return (
    <div className="space-y-0">
      {Array.from({ length: maxLines }, (_, i) => {
        const oldLine = oldLines[i] || ''
        const newLine = newLines[i] || ''
        const hasChanged = oldLine !== newLine
        const wasAdded = i >= oldLines.length
        const wasRemoved = i >= newLines.length

        let bgColor = 'bg-transparent'
        let textColor = 'text-inherit'

        if (hasChanged) {
          bgColor = 'bg-yellow-100'
          textColor = 'text-yellow-900'
        } else if (wasAdded) {
          bgColor = 'bg-green-100'
          textColor = 'text-green-900'
        } else if (wasRemoved) {
          bgColor = 'bg-red-100'
          textColor = 'text-red-900'
        }

        return (
          <div
            key={i}
            className={`flex text-xs font-mono ${bgColor} ${textColor} border-l-2 ${
              hasChanged ? 'border-yellow-400' :
              wasAdded ? 'border-green-400' :
              wasRemoved ? 'border-red-400' : 'border-transparent'
            }`}
          >
            {/* Line numbers */}
            <div className="w-8 text-right pr-2 text-muted-foreground border-r flex-shrink-0 text-xs">
              {i < oldLines.length ? i + 1 : ''}
            </div>

            {/* Old content */}
            <div className="flex-1 px-2 py-0.5 border-r min-w-0">
              {wasAdded ? '' : <span className="whitespace-pre-wrap break-words block">{oldLine}</span>}
            </div>

            {/* New content */}
            <div className="flex-1 px-2 py-0.5 min-w-0">
              {wasRemoved ? '' : <span className="whitespace-pre-wrap break-words block">{newLine}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}