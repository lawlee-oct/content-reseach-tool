'use client'

// BlogResearcher Component
// Drop vào bất kỳ page NextJS nào là chạy được
// Ví dụ: import BlogResearcher from '@/components/BlogResearcher'

import { useState, useMemo, memo } from 'react'
import { useResearch } from '../hooks/useResearch'
import { FinalReport, BlogTypeReport } from '../types'

export default function BlogResearcher() {
  const [inputType, setInputType] = useState<'text' | 'url'>('text')
  const [inputValue, setInputValue] = useState('')
  const [maxUrls, setMaxUrls] = useState<number>(50)
  const { state, startResearch, reset } = useResearch()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    startResearch({ type: inputType, value: inputValue.trim(), maxUrls })
  }

  const handleExportJSON = () => {
    if (!state.report) return
    const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blog-research-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    if (!state.report) return
    const headers = ['Pattern Name', 'Title Template', 'SEO Score', 'Difficulty', 'Word Count', 'Title Example 1', 'Title Example 2', 'H2 Structure']
    const rows = state.report.blogTypes.map(bt => [
      `"${bt.patternName}"`,
      `"${bt.titleTemplate}"`,
      bt.seoScore,
      bt.difficulty,
      `"${bt.recommendedWordCount}"`,
      `"${bt.titleExamples[0] ?? ''}"`,
      `"${bt.titleExamples[1] ?? ''}"`,
      `"${bt.headingStructure.h2s.slice(0, 4).join(' | ')}"`,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blog-research-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Blog Research Tool
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Phân tích competitor và gợi ý 15–20 dạng bài blog có SEO tốt
        </p>
      </div>

      {/* Input Form */}
      {state.status === 'idle' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInputType('text')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputType === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              Nhập niche / brand
            </button>
            <button
              type="button"
              onClick={() => setInputType('url')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputType === 'url'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              Nhập URL
            </button>
          </div>

          {/* Input field + Max URLs */}
          <div className="flex gap-3 items-center">
            <input
              type={inputType === 'url' ? 'url' : 'text'}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={
                inputType === 'text'
                  ? 'VD: best wireless earbuds, smart home devices, coffee maker...'
                  : 'VD: https://yourcompetitor.com'
              }
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />

            {/* Thêm ô chọn maxUrls */}
            <div className="flex items-center gap-1">
              <label htmlFor="maxUrls" className="text-xs text-gray-600 dark:text-gray-300">Max URLs</label>
              <input
                id="maxUrls"
                type="number"
                min={5}
                max={100}
                step={1}
                value={maxUrls}
                onChange={e => setMaxUrls(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Số lượng bài viết tối đa sẽ crawl"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium 
                         hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Phân tích
            </button>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Số bài viết sẽ crawl/tìm cho competitor (nên <span className="text-blue-500">{maxUrls}</span>, tối đa 100)
          </div>
        </form>
      )}

      {/* Progress */}
      {state.status === 'running' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              Bước {state.step}/4: {state.message}
            </span>
            <span className="text-blue-600 font-medium">{state.progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${state.progress}%` }}
            />
          </div>

          {/* Steps indicator */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { n: 1, label: 'Competitor Discovery' },
              { n: 2, label: 'Content Crawling' },
              { n: 3, label: 'Pattern Analysis' },
              { n: 4, label: 'Report Generation' },
            ].map(({ n, label }) => (
              <div
                key={n}
                className={`p-3 rounded-lg text-xs text-center transition-colors ${
                  state.step > n
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : state.step === n
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 ring-1 ring-blue-200'
                    : 'bg-gray-50 text-gray-400 dark:bg-gray-800'
                }`}
              >
                <div className="font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
          <button
            onClick={reset}
            className="mt-3 text-sm text-red-600 underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Results */}
      {state.status === 'done' && state.report && (
        <ResultsPanel
          report={state.report}
          onReset={reset}
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
        />
      )}
    </div>
  )
}

// ─── Results Panel ────────────────────────────────────────────────────────────

function ResultsPanel({
  report,
  onReset,
  onExportJSON,
  onExportCSV,
}: {
  report: FinalReport
  onReset: () => void
  onExportJSON: () => void
  onExportCSV: () => void
}) {
  const [selected, setSelected] = useState<BlogTypeReport | null>(null)
  const [filterDiff, setFilterDiff] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [sortBy, setSortBy] = useState<'seoScore' | 'frequency'>('seoScore')

  const filtered = useMemo(() => {
    return report.blogTypes
      .filter(bt => filterDiff === 'all' || bt.difficulty === filterDiff)
      .slice()
      .sort((a, b) => {
        if (sortBy === 'seoScore') return b.seoScore - a.seoScore
        return 0
      })
  }, [report.blogTypes, filterDiff, sortBy])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">{report.summary}</p>
        <div className="flex gap-4 mt-2 text-xs text-blue-600 dark:text-blue-400">
          <span>{report.totalArticlesAnalyzed} bài phân tích</span>
          <span>{report.blogTypes.length} blog types</span>
          <span>Top competitor: {report.topCompetitors[0]}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
            <button
              key={d}
              onClick={() => setFilterDiff(d)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filterDiff === d
                  ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {d === 'all' ? 'Tất cả' : d}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportCSV}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={onExportJSON}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
          >
            Research mới
          </button>
        </div>
      </div>

      {/* Blog Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(bt => (
          <BlogTypeCard
            key={bt.patternId}
            blogType={bt}
            isSelected={selected?.patternId === bt.patternId}
            onClick={() => setSelected(selected?.patternId === bt.patternId ? null : bt)}
          />
        ))}
      </div>

      {/* Detail Panel */}
      {selected && (
        <BlogTypeDetail blogType={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Blog Type Card ───────────────────────────────────────────────────────────

const BlogTypeCard = memo(function BlogTypeCard({
  blogType: bt,
  isSelected,
  onClick,
}: {
  blogType: BlogTypeReport
  isSelected: boolean
  onClick: () => void
}) {
  const diffColor = {
    easy: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
    medium: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
    hard: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
  }[bt.difficulty]

  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
          {bt.patternName}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${diffColor}`}>
            {bt.difficulty}
          </span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {bt.seoScore}/10
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-3">
        {bt.titleTemplate}
      </p>

      <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
        <span>{bt.recommendedWordCount}</span>
        <span>·</span>
        <span>{bt.exampleUrls.length} examples</span>
      </div>
    </button>
  )
})

// ─── Blog Type Detail ─────────────────────────────────────────────────────────

function BlogTypeDetail({
  blogType: bt,
  onClose,
}: {
  blogType: BlogTypeReport
  onClose: () => void
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-5">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{bt.patternName}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Title examples */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Title mẫu sẵn dùng</h4>
        <div className="space-y-2">
          {bt.titleExamples.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 mt-0.5 w-4 shrink-0">{i + 1}.</span>
              <p className="text-sm text-gray-800 dark:text-gray-200">{t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Heading structure */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Cấu trúc Heading</h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-mono shrink-0">H1</span>
            <span className="text-gray-700 dark:text-gray-300">{bt.headingStructure.h1}</span>
          </div>
          {bt.headingStructure.h2s.map((h, i) => (
            <div key={i} className="flex gap-2 pl-4">
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono shrink-0">H2</span>
              <span className="text-gray-600 dark:text-gray-400">{h}</span>
            </div>
          ))}
          {bt.headingStructure.notes && (
            <p className="text-xs text-gray-400 dark:text-gray-500 pl-4 mt-2 italic">{bt.headingStructure.notes}</p>
          )}
        </div>
      </div>

      {/* Content tips */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Content Tips</h4>
        <ul className="space-y-2">
          {bt.contentTips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-blue-500 shrink-0">→</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* SEO notes */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">SEO Notes</h4>
        <p className="text-sm text-gray-700 dark:text-gray-300">{bt.seoNotes}</p>
      </div>

      {/* Example URLs */}
      {bt.exampleUrls.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Evidence URLs</h4>
          <div className="space-y-1">
            {bt.exampleUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
              >
                {url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
