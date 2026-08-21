'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  LayoutGrid,
  List,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react';
import type { ItemPageSize, ItemSortBy } from '../types';

export function SortFieldMenu({
  value,
  onChange,
}: {
  value: ItemSortBy;
  onChange: (value: ItemSortBy) => void;
}) {
  const labels: Record<ItemSortBy, string> = {
    name: 'Name',
    createdAt: 'Created',
    size: 'Size',
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 min-w-32 items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {labels[value]}
          <ChevronDown className="size-4 text-zinc-500" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {(Object.keys(labels) as ItemSortBy[]).map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onChange(option)}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              {labels[option]}
              {option === value ? (
                <Check className="size-4 text-indigo-600" />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function PageSizeMenu({
  value,
  onChange,
}: {
  value: ItemPageSize;
  onChange: (value: ItemPageSize) => void;
}) {
  const options: ItemPageSize[] = [10, 25, 50];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {value} per page
          <ChevronDown className="size-4 text-zinc-500" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onChange(option)}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              {option} items
              {option === value ? (
                <Check className="size-4 text-indigo-600" />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: 'table' | 'grid';
  onChange: (value: 'table' | 'grid') => void;
}) {
  return (
    <div
      className="flex rounded-lg border border-zinc-300 p-1 dark:border-zinc-700"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-pressed={value === 'table'}
        aria-label="Table view"
        className={`rounded-md p-2 ${value === 'table' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
        aria-label="Grid view"
        className={`rounded-md p-2 ${value === 'grid' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
      >
        <LayoutGrid className="size-4" />
      </button>
    </div>
  );
}

export function RoomItemsToolbar({
  sortBy,
  sortOrder,
  sortOrderLabel,
  viewMode,
  onSortByChange,
  onSortOrderToggle,
  onViewModeChange,
}: {
  sortBy: ItemSortBy;
  sortOrder: 'asc' | 'desc';
  sortOrderLabel: string;
  viewMode: 'table' | 'grid';
  onSortByChange: (value: ItemSortBy) => void;
  onSortOrderToggle: () => void;
  onViewModeChange: (value: 'table' | 'grid') => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <SortFieldMenu value={sortBy} onChange={onSortByChange} />
        <button
          type="button"
          onClick={onSortOrderToggle}
          className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700"
          aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
        >
          {sortOrderLabel}
        </button>
      </div>
      <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
    </div>
  );
}

export function BulkSelectionBar({
  count,
  onMove,
  onDelete,
  onClear,
}: {
  count: number;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 sm:flex sm:flex-wrap sm:items-center dark:border-indigo-900/70 dark:bg-indigo-950/40">
      <span className="col-span-2 text-sm font-medium text-indigo-950 sm:col-span-1 sm:mr-auto dark:text-indigo-100">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onMove}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
      >
        <FolderInput className="size-4" />
        Move
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm dark:bg-zinc-900 dark:text-red-400"
      >
        <Trash2 className="size-4" />
        Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="col-span-2 min-h-11 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-white sm:col-span-1 sm:size-11 sm:p-2 dark:hover:bg-zinc-900"
      >
        <X className="mx-auto size-4" />
        <span className="ml-2 sm:sr-only">Clear selection</span>
      </button>
    </div>
  );
}

export function PaginationControls({
  pageSize,
  pageNumber,
  canGoPrevious,
  canGoNext,
  isLoadingNext,
  onPageSizeChange,
  onPrevious,
  onNext,
}: {
  pageSize: ItemPageSize;
  pageNumber: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLoadingNext: boolean;
  onPageSizeChange: (value: ItemPageSize) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
      <PageSizeMenu value={pageSize} onChange={onPageSizeChange} />
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Page {pageNumber}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={onPrevious}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={onNext}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isLoadingNext ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Next
            {!isLoadingNext ? <ChevronRight className="size-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
