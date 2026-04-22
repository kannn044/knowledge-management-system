import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  FileText,
  Clock,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { searchApi } from '@/services/searchApi';
import { SearchResult, FileType } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ─── Helpers ──────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.75) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 0.5) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-slate-500 bg-slate-50 border-slate-200';
}

function scoreLabel(score: number): string {
  if (score >= 0.85) return 'Excellent';
  if (score >= 0.70) return 'Good';
  if (score >= 0.50) return 'Fair';
  return 'Low';
}

const FILE_TYPE_LABELS: Record<FileType, string> = {
  pdf: 'PDF',
  txt: 'TXT',
  md: 'Markdown',
};

const FILE_TYPE_COLORS: Record<FileType, string> = {
  pdf: 'bg-red-100 text-red-700',
  txt: 'bg-blue-100 text-blue-700',
  md: 'bg-purple-100 text-purple-700',
};

// ─── Highlight matched terms ──────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!words.length) return text;
  const pattern = new RegExp(`(${words.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  return (
    <div className="card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
              FILE_TYPE_COLORS[result.file_type] ?? 'bg-slate-100 text-slate-700'
            }`}
          >
            {FILE_TYPE_LABELS[result.file_type] ?? result.file_type.toUpperCase()}
          </span>
          <Link
            to={`/documents`}
            className="text-sm font-semibold text-slate-900 hover:text-primary-600 truncate"
            title={result.title}
          >
            {result.title}
          </Link>
        </div>

        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded border ${scoreColor(
            result.similarity_score
          )}`}
        >
          {scoreLabel(result.similarity_score)} &middot;{' '}
          {Math.round(result.similarity_score * 100)}%
        </span>
      </div>

      {/* Chunk text with highlighting */}
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
        {highlight(result.chunk_text, query)}
      </p>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-400">
        {result.department && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
            {result.department}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {dayjs(result.created_at).fromNow()}
        </span>
        <span>by {result.uploaded_by}</span>
      </div>
    </div>
  );
}

// ─── Filter dropdown ──────────────────────────────────────────────

interface FilterBarProps {
  departments: string[];
  selectedDept: string;
  setSelectedDept: (v: string) => void;
  selectedType: string;
  setSelectedType: (v: string) => void;
  topK: number;
  setTopK: (v: number) => void;
}

function FilterBar({
  departments,
  selectedDept,
  setSelectedDept,
  selectedType,
  setSelectedType,
  topK,
  setTopK,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeCount = [selectedDept, selectedType].filter(Boolean).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`btn btn-secondary flex items-center gap-2 relative ${
          activeCount > 0 ? 'ring-2 ring-primary-400' : ''
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
        {activeCount > 0 && (
          <span className="w-4 h-4 text-xs bg-primary-600 text-white rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-20 space-y-4">
          {/* Department */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Department</label>
            <select
              className="input-field text-sm"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* File type */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">File Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['', 'pdf', 'txt', 'md'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedType === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-slate-200 text-slate-600 hover:border-primary-300'
                  }`}
                >
                  {t === '' ? 'All' : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Top K */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Results: <span className="font-semibold text-slate-800">{topK}</span>
            </label>
            <input
              type="range"
              min={3}
              max={30}
              step={1}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>3</span>
              <span>30</span>
            </div>
          </div>

          {/* Clear */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedDept('');
                setSelectedType('');
              }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function SearchPage() {
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [topK, setTopK] = useState(10);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load filter suggestions once
  const { data: suggestions } = useQuery({
    queryKey: ['search-suggestions'],
    queryFn: searchApi.getSuggestions,
    staleTime: 5 * 60_000,
  });

  // Search mutation — triggered manually
  const {
    mutate: doSearch,
    data: searchData,
    isPending: isSearching,
    error: searchError,
    reset: resetSearch,
  } = useMutation({
    mutationFn: () =>
      searchApi.search({
        query,
        top_k: topK,
        filters: {
          ...(selectedDept ? { department: selectedDept } : {}),
          ...(selectedType ? { file_type: selectedType as FileType } : {}),
        },
      }),
  });

  // Auto-debounce input → set query (300ms)
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(value.trim());
    }, 300);
  }, []);

  // Trigger search whenever query or filters change (only if query is non-empty)
  useEffect(() => {
    if (query.length >= 2) {
      doSearch();
    } else {
      resetSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedDept, selectedType, topK]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed.length >= 2) {
      setQuery(trimmed);
    }
  };

  const clearSearch = () => {
    setInputValue('');
    setQuery('');
    resetSearch();
  };

  const results = searchData?.results ?? [];
  const hasSearched = query.length >= 2;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Semantic Search</h1>
            <p className="text-xs text-slate-500">Ask a natural-language question across all documents</p>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="e.g. What is the company's leave policy?"
              className="input-field pl-9 pr-9"
              autoFocus
            />
            {inputValue && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <FilterBar
            departments={suggestions?.departments ?? []}
            selectedDept={selectedDept}
            setSelectedDept={setSelectedDept}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            topK={topK}
            setTopK={setTopK}
          />

          <button type="submit" className="btn btn-primary px-4">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Search</span>
          </button>
        </form>

        {/* Active filter chips */}
        {(selectedDept || selectedType) && (
          <div className="flex flex-wrap gap-2">
            {selectedDept && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded-full">
                {selectedDept}
                <button onClick={() => setSelectedDept('')} className="hover:text-primary-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded-full">
                {selectedType.toUpperCase()}
                <button onClick={() => setSelectedType('')} className="hover:text-primary-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {isSearching && (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Searching documents…</span>
          </div>
        )}

        {/* Error */}
        {searchError && !isSearching && (
          <div className="card bg-red-50 border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              {(searchError as Error).message || 'Search failed. Please try again.'}
            </p>
          </div>
        )}

        {/* Results */}
        {!isSearching && hasSearched && searchData && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {results.length > 0 ? (
                  <>
                    <span className="font-semibold text-slate-700">{results.length}</span>{' '}
                    result{results.length !== 1 ? 's' : ''} in{' '}
                    <span className="font-semibold text-slate-700">
                      {searchData.query_time_ms}ms
                    </span>
                  </>
                ) : (
                  'No results found'
                )}
              </p>
            </div>

            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map((result, idx) => (
                  <ResultCard key={`${result.document_id}-${idx}`} result={result} query={query} />
                ))}
              </div>
            ) : (
              <div className="card flex flex-col items-center gap-3 py-16 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">No matching documents found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try different keywords or remove filters
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state — no search yet */}
        {!hasSearched && !isSearching && (
          <div className="card flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
              <Search className="w-7 h-7 text-primary-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Start searching your knowledge base</p>
              <p className="text-xs text-slate-400 mt-1">
                Type a question or keyword above — AI will find the most relevant content
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {[
                'company leave policy',
                'IT security guidelines',
                'onboarding checklist',
                'expense reimbursement',
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleInputChange(s)}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-full text-slate-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
